const edges_frag = "                                                                                                                            \n\
  uniform vec2 uInverseResolution;                                                                                                            \n\
  uniform sampler2D uNormals;                                                                                                                 \n\
                                                                                                                                              \n\
  varying vec2 vUV;                                                                                                                           \n\
                                                                                                                                              \n\
  void main() {                                                                                                                               \n\
    // TODO: look at 8direction?                                                                                                              \n\
    // TODO: check for inversion/winding? (when you crumple, verts can go by each other)                                                      \n\
    vec2 offsetX = vec2(1.0 * uInverseResolution.x, 0.0);                                                                                     \n\
    vec2 offsetY = vec2(0.0, 1.0 * uInverseResolution.y);                                                                                     \n\
    vec3 normalC = normalize(texture2D(uNormals, vUV).xyz * 2.0 - 1.0);                                                                       \n\
    vec3 normalN = normalize(texture2D(uNormals, vUV - offsetY).xyz * 2.0 - 1.0);                                                             \n\
    vec3 normalS = normalize(texture2D(uNormals, vUV + offsetY).xyz * 2.0 - 1.0);                                                             \n\
    vec3 normalE = normalize(texture2D(uNormals, vUV + offsetX).xyz * 2.0 - 1.0);                                                             \n\
    vec3 normalW = normalize(texture2D(uNormals, vUV - offsetX).xyz * 2.0 - 1.0);                                                             \n\
    float accel = min(min(min(dot(normalC, normalN), dot(normalC, normalS)), dot(normalC, normalE)), dot(normalC, normalW));                  \n\
    accel = accel * -0.5 + 0.5;                                                                                                               \n\
                                                                                                                                              \n\
    gl_FragColor = vec4(accel);                                                                                                               \n\
  }                                                                                                                                           \n\
";