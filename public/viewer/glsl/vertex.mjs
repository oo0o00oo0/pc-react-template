export default /* glsl */ `
// ============================================================================
// Gaussian Splatting Vertex Shader
// This shader renders Gaussian splats with optional spherical harmonics lighting,
// per-splat ordering, and animated transitions. It computes the splat center,
// corner offsets in clip space, and applies color blending and fading.
// ============================================================================

// -----------------------------------------------------------------------------
// Varying variables (passed to the fragment shader)
varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

#ifndef DITHER_NONE
    varying float id;  // Used for dithering if enabled
#endif

#ifdef PREPASS_PASS
    varying float vLinearDepth;  // Used for depth pre-pass
#endif

// -----------------------------------------------------------------------------
// Uniforms
uniform float uSplatSize;    // Overall scaling factor for splat size
uniform float uTime;         // Global time for transitions

// Vertex attributes:
// - vertex_position.xy: Corner UV coordinates (range: -1 to 1)
// - vertex_position.z: Render order offset
// - vertex_id_attrib: Base render order for the splat
attribute vec3 vertex_position;
attribute uint vertex_id_attrib;

// Splat ordering uniforms:
uniform uint numSplats;                 // Total number of splats
uniform highp usampler2D splatOrder;    // Texture storing per-splat index to source gaussian

// Transformation matrices:
uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;

// Viewport and camera parameters:
uniform vec2 viewport;      // Viewport dimensions
uniform vec4 camera_params; // Additional camera parameters

// -----------------------------------------------------------------------------
// Structures

// SplatSource:
// Holds the render order, splat id, source UV coordinates, and per-vertex corner.
struct SplatSource {
    uint order;         // Render order of this splat
    uint id;            // Splat identifier
    ivec2 uv;           // Source UV coordinates in the splatOrder texture
    vec2 cornerUV;      // Corner coordinates for this vertex (-1 to 1)
};

// SplatCenter:
// Contains the splat's center in view and clip space, the model-view matrix,
// and a projection matrix element for focal length calculations.
struct SplatCenter {
    vec3 view;          // Center in view space
    vec4 proj;          // Center in clip space
    mat4 modelView;     // Combined model-view matrix
    float projMat00;    // Element [0][0] of the projection matrix
};

// SplatCorner:
// Represents the offset for a Gaussian's corner in clip space.
struct SplatCorner {
    vec2 offset;        // Offset from the center in clip space
    vec2 uv;            // Modified corner UV coordinates
};

// -----------------------------------------------------------------------------
// Spherical Harmonics (SH) setup
#if SH_BANDS > 0
    #if SH_BANDS == 1
        #define SH_COEFFS 3
    #elif SH_BANDS == 2
        #define SH_COEFFS 8
    #elif SH_BANDS == 3
        #define SH_COEFFS 15
    #endif
#endif

// Include data and SH functions based on compression settings:
#if GSPLAT_COMPRESSED_DATA == true
    #include "gsplatCompressedDataVS"
    #include "gsplatCompressedSHVS"
#else
    #include "gsplatDataVS"
    #include "gsplatColorVS"
    #include "gsplatSHVS"
#endif

// -----------------------------------------------------------------------------
// Function: initSource
// Initializes the SplatSource structure by calculating the render order, 
// fetching the splat id from the splatOrder texture, and mapping it to UV.
// Returns false if the splat order is out of range.
bool initSource(out SplatSource source) {
    uint w = uint(textureSize(splatOrder, 0).x);

    // Compute render order: base order plus per-vertex offset.
    source.order = vertex_id_attrib + uint(vertex_position.z);

    // If the splat is out of range, skip processing.
    if (source.order >= numSplats) {
        return false;
    }

    // Determine the texture coordinate in the splatOrder texture.
    ivec2 orderUV = ivec2(source.order % w, source.order / w);

    // Fetch the splat id and map it to UV coordinates.
    source.id = texelFetch(splatOrder, orderUV, 0).r;
    source.uv = ivec2(source.id % w, source.id / w);

    // Store the corner coordinates from the vertex attribute.
    source.cornerUV = vertex_position.xy;

    return true;
}

// -----------------------------------------------------------------------------
// Function: initCenter
// Calculates the center of the splat (in view and clip space) using the model
// transformation and projection matrices. Returns false if the splat is behind the camera.
bool initCenter(vec3 modelCenter, out SplatCenter center) {
    mat4 modelView = matrix_view * matrix_model;
    vec4 centerView = modelView * vec4(modelCenter, 1.0);

    // Discard splats behind the camera.
    if (centerView.z > 0.0) {
        return false;
    }

    // Project the center into clip space.
    vec4 centerProj = matrix_projection * centerView;
    // Clamp z coordinate to prevent clipping by near/far planes.
    centerProj.z = clamp(centerProj.z, -abs(centerProj.w), abs(centerProj.w));

    center.view = centerView.xyz / centerView.w;
    center.proj = centerProj;
    center.projMat00 = matrix_projection[0][0];
    center.modelView = modelView;
    return true;
}

// -----------------------------------------------------------------------------
// Function: initCorner
// Computes the offset in clip space for a given Gaussian corner by evaluating
// the covariance matrix and applying camera transformations. Returns false if
// the Gaussian is too small or outside the view frustum.
bool initCorner(SplatSource source, SplatCenter center, out SplatCorner corner) {
    // Retrieve covariance data from the source.
    vec3 covA, covB;
    readCovariance(source, covA, covB);

    // Construct the covariance matrix.
    mat3 Vrk = mat3(
        covA.x, covA.y, covA.z, 
        covA.y, covB.x, covB.y,
        covA.z, covB.y, covB.z
    );

    // Compute focal length using viewport and projection matrix.
    float focal = viewport.x * center.projMat00;

    // Determine view direction based on camera parameters.
    vec3 v = camera_params.w == 1.0 ? vec3(0.0, 0.0, 1.0) : center.view.xyz;
    float J1 = focal / v.z;
    vec2 J2 = -J1 / v.z * v.xy;
    mat3 J = mat3(
        J1, 0.0, J2.x, 
        0.0, J1, J2.y, 
        0.0, 0.0, 0.0
    );

    // Transform covariance into clip space.
    mat3 W = transpose(mat3(center.modelView));
    mat3 T = W * J;
    mat3 cov = transpose(T) * Vrk * T;

    // Adjust the covariance diagonals.
    float diagonal1 = cov[0][0] + 0.3;
    float offDiagonal = cov[0][1];
    float diagonal2 = cov[1][1] + 0.3;

    // Compute eigenvalue approximations.
    float mid = 0.5 * (diagonal1 + diagonal2);
    float radius = length(vec2((diagonal1 - diagonal2) / 2.0, offDiagonal));
    float lambda1 = mid + radius;
    float lambda2 = max(mid - radius, 0.1);

    // Compute the lengths for the Gaussian ellipse axes.
    float l1 = 2.0 * min(sqrt(2.0 * lambda1), 1024.0);
    float l2 = 2.0 * min(sqrt(2.0 * lambda2), 1024.0);

    // Discard gaussians that are too small (less than 2 pixels on both axes).
    if (l1 < 2.0 && l2 < 2.0) {
        return false;
    }

    // Compute a culling parameter based on clip space.
    vec2 c = center.proj.ww / viewport;
    if (any(greaterThan(abs(center.proj.xy) - vec2(max(l1, l2)) * c, center.proj.ww))) {
        return false;
    }

    // Determine the diagonal vector of the ellipse.
    vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));
    vec2 v1 = l1 * diagonalVector;
    vec2 v2 = l2 * vec2(diagonalVector.y, -diagonalVector.x);

    // Calculate the final offset for the current vertex.
    corner.offset = (source.cornerUV.x * v1 + source.cornerUV.y * v2) * c;
    corner.uv = source.cornerUV;

    return true;
}

// -----------------------------------------------------------------------------
// Include output processing (e.g. final positioning and any additional passes)
#include "gsplatOutputVS"

// -----------------------------------------------------------------------------
// Function: clipCorner
// Scales the Gaussian corner so that regions with an alpha less than 1/255
// are effectively discarded.
void clipCorner(inout SplatCorner corner, float alpha) {
    float clip = min(1.0, sqrt(-log(1.0 / 255.0 / alpha)) / 2.0);
    corner.offset *= clip;
    corner.uv *= clip;
}

// -----------------------------------------------------------------------------
// Spherical Harmonics (SH) functions and coefficients
#if SH_BANDS > 0
    #define SH_C1 0.4886025119029199f

    #if SH_BANDS > 1
        #define SH_C2_0 1.0925484305920792f
        #define SH_C2_1 -1.0925484305920792f
        #define SH_C2_2 0.31539156525252005f
        #define SH_C2_3 -1.0925484305920792f
        #define SH_C2_4 0.5462742152960396f
    #endif

    #if SH_BANDS > 2
        #define SH_C3_0 -0.5900435899266435f
        #define SH_C3_1 2.890611442640554f
        #define SH_C3_2 -0.4570457994644658f
        #define SH_C3_3 0.3731763325901154f
        #define SH_C3_4 -0.4570457994644658f
        #define SH_C3_5 1.445305721320277f
        #define SH_C3_6 -0.5900435899266435f
    #endif

    // Function: evalSH
    // Evaluates spherical harmonics for a given direction vector. Reads SH coefficients
    // from the splat source and applies them to modify the color.
    // Reference: https://github.com/graphdeco-inria/gaussian-splatting/blob/main/utils/sh_utils.py
    vec3 evalSH(in SplatSource source, in vec3 dir) {
        // Read SH coefficients and a scaling factor.
        vec3 sh[SH_COEFFS];
        float scale;
        readSHData(source, sh, scale);

        float x = dir.x;
        float y = dir.y;
        float z = dir.z;

        // First degree contribution.
        vec3 result = SH_C1 * (-sh[0] * y + sh[1] * z - sh[2] * x);

        #if SH_BANDS > 1
            // Second degree contributions.
            float xx = x * x;
            float yy = y * y;
            float zz = z * z;
            float xy = x * y;
            float yz = y * z;
            float xz = x * z;

            result +=
                sh[3] * (SH_C2_0 * xy) +
                sh[4] * (SH_C2_1 * yz) +
                sh[5] * (SH_C2_2 * (2.0 * zz - xx - yy)) +
                sh[6] * (SH_C2_3 * xz) +
                sh[7] * (SH_C2_4 * (xx - yy));
        #endif

        #if SH_BANDS > 2
            // Third degree contributions.
            result +=
                sh[8]  * (SH_C3_0 * y * (3.0 * xx - yy)) +
                sh[9]  * (SH_C3_1 * xy * z) +
                sh[10] * (SH_C3_2 * y * (4.0 * zz - xx - yy)) +
                sh[11] * (SH_C3_3 * z * (2.0 * zz - 3.0 * xx - 3.0 * yy)) +
                sh[12] * (SH_C3_4 * x * (4.0 * zz - xx - yy)) +
                sh[13] * (SH_C3_5 * z * (xx - yy)) +
                sh[14] * (SH_C3_6 * x * (xx - 3.0 * yy));
        #endif

        return result * scale;
    }
#endif

// -----------------------------------------------------------------------------
// Helper Functions

// fade:
// Returns a fade value based on the distance from the center.
// 'radius' defines the transition radius, 'len' is the distance from the center,
// and 'feather' controls the softness of the edge.
float fade(float radius, float len, float feather) {
    return 1.0 - smoothstep(radius - feather, radius + feather, len);
}

// transitionInSize:
// Computes the size transition for a splat over time.
// It blends an initial small "particle" transition with a full-size transition.
vec2 transitionInSize(vec3 origin, vec3 center, SplatCorner corner, float speed, float startDelay) {
    float power = 2.0;             // Exponent for transition curve
    float secondaryFadeDelay = 0.7; // Delay between initial and full transition
    float pixelSize = 0.01;         // Size of the initial particle pass
    float fadeBlend = 0.3;          // Softness factor for fading edges

    // Initial transition (small particle fade-in)
    float radius = (uTime - startDelay) * speed;
    float len = length(origin - center);
    vec2 sizeA = normalize(corner.offset) * fade(pow(radius, 1.2), len, fadeBlend) * pixelSize;

    // Secondary transition (full size fade-in)
    radius = max(0.0, (uTime - startDelay - secondaryFadeDelay)) * speed;
    float fullFade = fade(pow(radius, power), len, fadeBlend);
    vec2 sizeB = corner.offset * fullFade;
    
    // Blend between the two transitions.
    return mix(sizeA, sizeB, fullFade);
}

// -----------------------------------------------------------------------------
// Main Shader Function
void main(void) {
    // 1. Initialize the splat source from vertex attributes and the splatOrder texture.
    SplatSource source;
    if (!initSource(source)) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);  // Discard vertex if out of range.
        return;
    }

    // 2. Read the Gaussian center from the source.
    vec3 modelCenter = readCenter(source);

    // 3. Compute the center in view and clip space.
    SplatCenter center;
    if (!initCenter(modelCenter, center)) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);  // Discard if behind camera.
        return;
    }

    // 4. Calculate the corner offset of the Gaussian.
    SplatCorner corner;
    if (!initCorner(source, center, corner)) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);  // Discard if too small or culled.
        return;
    }

    // 5. Read the base color.
    vec4 clr = readColor(source);

    // 6. Optionally, add spherical harmonics lighting.
    #if SH_BANDS > 0
        // Compute model-space view direction.
        vec3 dir = normalize(center.view * mat3(center.modelView));
        clr.xyz += evalSH(source, dir);
    #endif

    // 7. Adjust the corner to clip regions with very low alpha.
    clipCorner(corner, clr.w);

    // 8. Compute animated transition size for the splat.
    vec3 origin = vec3(0.0);
    float speed = 1.2;
    float transitionDelay = 0.0;
    vec2 size = transitionInSize(origin, modelCenter, corner, speed, transitionDelay);

    // 9. Compute final clip-space position.
    gl_Position = center.proj + vec4(corner.offset * uSplatSize, 0.0, 0.0);

    // 10. Blend the base color with a predefined color based on splat size.
    vec4 colMix = mix(vec4(0.26, 0.94, 1.00, 1.0), clr, uSplatSize);

    // 11. Output the final UV and color values.
    gaussianUV = corner.uv;
    gaussianColor = vec4(prepareOutputFromGamma(max(colMix.xyz, 0.0)), colMix.w);

    #ifdef PREPASS_PASS
        vLinearDepth = -center.view.z;
    #endif
}
`;
