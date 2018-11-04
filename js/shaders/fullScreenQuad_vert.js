const fullScreenQuad_vert = "                                     \n\
  varying vec2 vUV;                                             \n\
                                                                \n\
  void main() {                                                 \n\
    vUV = uv;                                                   \n\
    gl_Position = vec4(position, 1.0);                          \n\
  }                                                             \n\
";