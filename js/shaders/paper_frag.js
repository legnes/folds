const paper_frag = "                                                                                                \n\
  // TODO: FINISH THIS!!!                                                                                         \n\
  const float AMBIENT_INTENSITY = 0.3;                                                                            \n\
  const float DIRECTIONAL_INTENSITY = 0.7;                                                                        \n\
  const vec3 DIRECTION = vec3(1.0, 0.0, 0.0);                                                                     \n\
                                                                                                                  \n\
  uniform sampler2D uSource;                                                                                      \n\
                                                                                                                  \n\
  varying vec2 vUV;                                                                                               \n\
  varying vec3 vPosition;                                                                                         \n\
                                                                                                                  \n\
  void main() {                                                                                                   \n\
    vec3 normal = normalize(cross(dFdx(vPosition), dFdy(vPosition)));                                             \n\
    float directionalIntensity = DIRECTIONAL_INTENSITY * (dot(normal, DIRECTION) * 0.5 + 0.5);                    \n\
                                                                                                                  \n\
    vec4 color = texture2D(uSource, vUV);                                                                         \n\
                                                                                                                  \n\
    gl_FragColor = vec4(mix(vec3(0.0), color.xyz, AMBIENT_INTENSITY + directionalIntensity), 1.0);                \n\
  }                                                                                                               \n\
";