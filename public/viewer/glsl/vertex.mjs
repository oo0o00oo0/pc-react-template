export default /* glsl */ `

#include "gsplatCommonVS"

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

#ifndef DITHER_NONE
    varying float id;
#endif

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

uniform float uTime;
uniform float uSwirlAmount;

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


vec3 animatePosition(vec3 center) {
    // modify center
    float heightIntensity = center.y * 0.2;
    center.x += sin(uTime * 5.0 + center.y) * 0.3 * heightIntensity;

    // output y-coordinate
    return center;
}

vec4 animateColor(float height, vec4 clr) {
    float sineValue = abs(sin(uTime * 5.0 + height));

    #ifdef CUTOUT
        // in cutout mode, remove pixels along the wave
        if (sineValue < 0.5) {
            clr.a = 0.0;
        }
    #else
        // in non-cutout mode, add a golden tint to the wave
        vec3 gold = vec3(1.0, 0.85, 0.0);
        float blend = smoothstep(0.9, 1.0, sineValue);
        clr.xyz = mix(clr.xyz, gold, blend);
    #endif

    return clr;
}

void main(void) {
    // read gaussian center
    SplatSource source;
    if (!initSource(source)) {
        gl_Position = discardVec;
        return;
    }

    vec3 centerPos = animatePosition(readCenter(source));

    SplatCenter center;
    initCenter(centerPos, center);

    // project center to screen space
    SplatCorner corner;
    if (!initCorner(source, center, corner)) {
        gl_Position = discardVec;
        return;
    }

    // read color
    vec4 clr = readColor(source);

    // evaluate spherical harmonics
    // #if SH_BANDS > 0
    //     vec3 dir = normalize(center.view * mat3(center.modelView));
    //     clr.xyz += evalSH(state, dir);
    // #endif


    clr = animateColor(centerPos.y, clr);

    clipCorner(corner, clr.w);

    vec3 origin = vec3(0.0);
    float speed = 1.2;
    float transitionDelay = 0.0;

    vec3 modelCenter = readCenter(source);

    vec2 size = transitionInSize(origin, modelCenter, corner, speed, transitionDelay);

    // size = mix(size, normalize(corner.offset) * 0.08, float(uSwirlAmount)); 


    gl_Position = center.proj + vec4(corner.offset * uSwirlAmount, 0.0, 0.0);

    gaussianUV = corner.uv;
    gaussianColor = vec4(prepareOutputFromGamma(max(clr.xyz, 0.0)), clr.w);

    #ifndef DITHER_NONE
        id = float(state.id);
    #endif
}


`;
