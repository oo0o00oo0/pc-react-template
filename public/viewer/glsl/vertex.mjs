export default /* glsl */ `

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

uniform float uSplatSize;
uniform float uTime;


attribute vec3 vertex_position;         // xy: cornerUV, z: render order offset
attribute uint vertex_id_attrib;        // render order base

uniform uint numSplats;                 // total number of splats
uniform highp usampler2D splatOrder;    // per-splat index to source gaussian


// stores the source UV and order of the splat
struct SplatSource {
    uint order;         // render order
    uint id;            // splat id
    ivec2 uv;           // splat uv
    vec2 cornerUV;      // corner coordinates for this vertex of the gaussian (-1, -1)..(1, 1)
};

// stores the camera and clip space position of the gaussian center
struct SplatCenter {
    vec3 view;          // center in view space
    vec4 proj;          // center in clip space
    mat4 modelView;     // model-view matrix
    float projMat00;    // elememt [0][0] of the projection matrix
};

// stores the offset from center for the current gaussian
struct SplatCorner {
    vec2 offset;        // corner offset from center in clip space
    vec2 uv;            // corner uv
};

#if SH_BANDS > 0
    #if SH_BANDS == 1
        #define SH_COEFFS 3
    #elif SH_BANDS == 2
        #define SH_COEFFS 8
    #elif SH_BANDS == 3
        #define SH_COEFFS 15
    #endif
#endif

#if GSPLAT_COMPRESSED_DATA == true
    #include "gsplatCompressedDataVS"
    #include "gsplatCompressedSHVS"
#else
    #include "gsplatDataVS"
    #include "gsplatColorVS"
    #include "gsplatSHVS"
#endif

// #include "gsplatSourceVS"

// initialize the splat source structure
bool initSource(out SplatSource source) {
    uint w = uint(textureSize(splatOrder, 0).x);

    // calculate splat order
    source.order = vertex_id_attrib + uint(vertex_position.z);

    // return if out of range (since the last block of splats may be partially full)
    if (source.order >= numSplats) {
        return false;
    }

    ivec2 orderUV = ivec2(source.order % w, source.order / w);

    // read splat id
    source.id = texelFetch(splatOrder, orderUV, 0).r;

    // map id to uv
    source.uv = ivec2(source.id % w, source.id / w);

    // get the corner
    source.cornerUV = vertex_position.xy;

    return true;
}
#include "gsplatCenterVS"
#include "gsplatCornerVS"
#include "gsplatOutputVS"

// modify the gaussian corner so it excludes gaussian regions with alpha
// less than 1/255
void clipCorner(inout SplatCorner corner, float alpha) {
    float clip = min(1.0, sqrt(-log(1.0 / 255.0 / alpha)) / 2.0);
    corner.offset *= clip;
    corner.uv *= clip;
}

// spherical Harmonics

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

// see https://github.com/graphdeco-inria/gaussian-splatting/blob/main/utils/sh_utils.py
vec3 evalSH(in SplatSource source, in vec3 dir) {

    // read sh coefficients
    vec3 sh[SH_COEFFS];
    float scale;
    readSHData(source, sh, scale);

    float x = dir.x;
    float y = dir.y;
    float z = dir.z;

    // 1st degree
    vec3 result = SH_C1 * (-sh[0] * y + sh[1] * z - sh[2] * x);

#if SH_BANDS > 1
    // 2nd degree
    float xx = x * x;
    float yy = y * y;
    float zz = z * z;
    float xy = x * y;
    float yz = y * z;
    float xz = x * z;

    result +=
        sh[3] * (SH_C2_0 * xy) *  +
        sh[4] * (SH_C2_1 * yz) +
        sh[5] * (SH_C2_2 * (2.0 * zz - xx - yy)) +
        sh[6] * (SH_C2_3 * xz) +
        sh[7] * (SH_C2_4 * (xx - yy));
#endif

#if SH_BANDS > 2
    // 3rd degree
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

#ifndef DITHER_NONE
    varying float id;
#endif

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

#ifdef PREPASS_PASS
    varying float vLinearDepth;
#endif
float fade(float radius, float len, float feather){
    return 1.0 - smoothstep(radius - feather, radius + feather, len);
}

vec2 transitionInSize(vec3 origin, vec3 center, SplatCorner corner, float speed, float startDelay){

    float power = 2.0; // transition curve
    float secondaryFadeDelay = 0.7; // The delay between the first and second animation
    float pixelSize = 0.01; // The size of the initial particle pass
    float fadeBlend = 0.3; // Higher values create a softer feathered fade edge

    float radius = (uTime - startDelay) * speed;
    float len = length(origin - center);

    // Initial particle transition
    vec2 sizeA = normalize(corner.offset) * fade(pow(radius, 1.2), len, fadeBlend) * pixelSize;

    // Secondary full transition
    radius = max(0.0, (uTime - startDelay - secondaryFadeDelay)) * speed;
    float fullFade = fade(pow(radius, power), len, fadeBlend);
    vec2 sizeB = corner.offset * fullFade;
    
    // mix between the two
    return mix(sizeA, sizeB, fullFade);
}



void main(void) {
    // read gaussian details
    SplatSource source;
    if (!initSource(source)) {
        gl_Position = discardVec;
        return;
    }

    vec3 modelCenter = readCenter(source);

    SplatCenter center;
    if (!initCenter(modelCenter, center)) {
        gl_Position = discardVec;
        return;
    }

    // project center to screen space
    SplatCorner corner;
    if (!initCorner(source, center, corner)) {
        gl_Position = discardVec;
        return;
    }

    // read color
    vec4 clr = readColor(source);

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        // calculate the model-space view direction
        vec3 dir = normalize(center.view * mat3(center.modelView));
        clr.xyz += evalSH(source, dir);
    #endif

    clipCorner(corner, clr.w);

    vec3 origin = vec3(0.0);
    float speed = 1.2;
    float transitionDelay = 0.0;


    vec2 size = transitionInSize(origin, modelCenter, corner, speed, transitionDelay);

    gl_Position = center.proj + vec4(corner.offset * uSplatSize, 0.0, 0.0);

    vec4 colMix = mix( vec4(0.26, 0.94, 1.00, 1.0), clr, uSplatSize);

    // write output
    // gl_Position = center.proj + vec4(corner.offset, 0, 0);
    gaussianUV = corner.uv;
    gaussianColor = vec4(prepareOutputFromGamma(max(colMix.xyz, 0.0)), colMix.w);

    #ifndef DITHER_NONE
        id = float(source.id);
    #endif

    #ifdef PREPASS_PASS
        vLinearDepth = -center.view.z;
    #endif
}
`;
