const edges_frag = "                                                                                                                            \n\
  uniform vec2 uInverseResolution;                                                                                                            \n\
  uniform sampler2D uNormals;                                                                                                                 \n\
                                                                                                                                              \n\
  varying vec2 vUV;                                                                                                                           \n\
                                                                                                                                              \n\
  void main() {                                                                                                                               \n\
    // TODO: check for inversion/winding? (when you crumple, verts can go by each other)                                                      \n\
    vec2 offsetX = vec2(1.0 * uInverseResolution.x, 0.0);                                                                                     \n\
    vec2 offsetY = vec2(0.0, 1.0 * uInverseResolution.y);                                                                                     \n\
                                                                                                                                              \n\
    // NOTE: For thinner lines, consider comparing C to N and E                                                                               \n\
    // vec3 normalC = normalize(texture2D(uNormals, vUV).xyz * 2.0 - 1.0);                                                                       \n\
    vec3 normalN = normalize(texture2D(uNormals, vUV - offsetY).xyz * 2.0 - 1.0);                                                             \n\
    vec3 normalS = normalize(texture2D(uNormals, vUV + offsetY).xyz * 2.0 - 1.0);                                                             \n\
    vec3 normalE = normalize(texture2D(uNormals, vUV + offsetX).xyz * 2.0 - 1.0);                                                             \n\
    vec3 normalW = normalize(texture2D(uNormals, vUV - offsetX).xyz * 2.0 - 1.0);                                                             \n\
    float accel = min(dot(normalN, normalS), dot(normalE, normalW));                                                                          \n\
                                                                                                                                              \n\
    // NOTE: Could use 8-direction here but it is more expensive and qualitatively I think it looks worse.                                    \n\
    // vec3 normalNE = normalize(texture2D(uNormals, vUV - offsetY + offsetX).xyz * 2.0 - 1.0);                                                  \n\
    // vec3 normalSE = normalize(texture2D(uNormals, vUV + offsetY + offsetX).xyz * 2.0 - 1.0);                                                  \n\
    // vec3 normalSW = normalize(texture2D(uNormals, vUV + offsetY - offsetX).xyz * 2.0 - 1.0);                                                  \n\
    // vec3 normalNW = normalize(texture2D(uNormals, vUV - offsetY - offsetX).xyz * 2.0 - 1.0);                                                  \n\
    // accel = min(accel, min(dot(normalNE, normalSW), dot(normalNW, normalSE)));                                                                \n\
                                                                                                                                              \n\
    accel = accel * -0.5 + 0.5;                                                                                                               \n\
    gl_FragColor = vec4(accel);                                                                                                               \n\
    // NOTE: This is probably more correct but I think it looks worse.                                                                        \n\
    //       One tradeoff is that it looks less aliased but loses the nice hotspots at nodes of heavy folding.                                \n\
    //       I guess you could think of this as a premultiplied alpha thing, which would be cool if we were doing                             \n\
    //       alpha/1-alpha blending, but we dont.                                                                                             \n\
    // gl_FragColor = vec4(1.0, 1.0, 1.0, accel);                                                                                                \n\
  }                                                                                                                                           \n\
";