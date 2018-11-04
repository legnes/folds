const displayTexture_frag = "                                                         \n\
  uniform sampler2D uSource;                                                        \n\
                                                                                    \n\
  varying vec2 vUV;                                                                 \n\
                                                                                    \n\
  void main() {                                                                     \n\
    gl_FragColor = texture2D(uSource, vUV);                                         \n\
  }                                                                                 \n\
";