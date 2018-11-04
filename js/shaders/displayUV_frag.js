const displayUV_frag = "                                                                  \n\
  varying vec2 vUV;                                                                     \n\
                                                                                        \n\
  void main() {                                                                         \n\
    gl_FragColor = vec4(vUV.x, 0.0, vUV.y, 1.0);                                        \n\
  }                                                                                     \n\
";