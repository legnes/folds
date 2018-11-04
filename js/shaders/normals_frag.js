const normals_frag = "                                                              \n\
  varying vec2 vUV;                                                               \n\
  varying vec3 vPosition;                                                         \n\
                                                                                  \n\
  void main() {                                                                   \n\
    vec3 normal = normalize(cross(dFdx(vPosition), dFdy(vPosition)));             \n\
    normal = normal * 0.5 + 0.5;                                                  \n\
    gl_FragColor = vec4(normal, 1.0);                                             \n\
  }                                                                               \n\
";