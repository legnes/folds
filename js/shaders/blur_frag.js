const blur_frag = "                                                                                                         \n\
  uniform vec2 uInverseResolution;                                                                                        \n\
  uniform vec2 uDir;                                                                                                      \n\
  uniform sampler2D uSource;                                                                                              \n\
                                                                                                                          \n\
  varying vec2 vUV;                                                                                                       \n\
                                                                                                                          \n\
  void main() {                                                                                                           \n\
    // REF: http://rastergrid.com/blog/2010/09/efficient-gaussian-blur-with-linear-sampling/                              \n\
    vec4 sum = vec4(0.0);                                                                                                 \n\
    sum += texture2D(uSource, vUV) * 0.2270270270;                                                                        \n\
    sum += texture2D(uSource, vUV + uInverseResolution * uDir * 1.3846153846) * 0.3162162162;                             \n\
    sum += texture2D(uSource, vUV - uInverseResolution * uDir * 1.3846153846) * 0.3162162162;                             \n\
    sum += texture2D(uSource, vUV + uInverseResolution * uDir * 3.2307692308) * 0.0702702703;                             \n\
    sum += texture2D(uSource, vUV - uInverseResolution * uDir * 3.2307692308) * 0.0702702703;                             \n\
    gl_FragColor = sum;                                                                                                   \n\
  }                                                                                                                       \n\
";