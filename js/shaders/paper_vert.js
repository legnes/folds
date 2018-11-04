const paper_vert = "                                                                                                                                  \n\
  const float PI = 3.1415926535897932384626433832795;                                                                                               \n\                                                                                                                                                            \n\
                                                                                                                                                    \n\
  attribute vec3 aDisplacementStart;                                                                                                                \n\
  attribute vec3 aDisplacementEnd;                                                                                                                  \n\
                                                                                                                                                    \n\
  uniform float uShouldDistort;                                                                                                                     \n\
  uniform float uTime;                                                                                                                              \n\
                                                                                                                                                    \n\
  varying vec2 vUV;                                                                                                                                 \n\
  varying vec3 vPosition;                                                                                                                           \n\
                                                                                                                                                    \n\
  void main() {                                                                                                                                     \n\
    vUV = uv;                                                                                                                                       \n\
                                                                                                                                                    \n\
    // TODO: Handle other animations eg crumple                                                                                                     \n\
    float angle = PI * uTime;                                                                                                                       \n\
    float horizontalProgress = -cos(angle) * 0.5 + 0.5;                                                                                             \n\
    float verticalProgress = sin(angle);                                                                                                            \n\
                                                                                                                                                    \n\
    vec2 deltaDisplacementXY = aDisplacementEnd.xy - aDisplacementStart.xy;                                                                         \n\
    float deltaDisplacementZ = length(deltaDisplacementXY) * 0.5;                                                                                   \n\
    vec3 currentDisplacement = aDisplacementStart + vec3(horizontalProgress * deltaDisplacementXY, verticalProgress * deltaDisplacementZ);          \n\
    vec3 newPosition = position + currentDisplacement;                                                                                              \n\
                                                                                                                                                    \n\
    vPosition = newPosition;                                                                                                                        \n\
    if (uShouldDistort < 0.5) {                                                                                                                     \n\
      newPosition = position;                                                                                                                       \n\
    }                                                                                                                                               \n\
                                                                                                                                                    \n\
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);                                                                      \n\                                                                                                                                                        \n\
  }                                                                                                                                                 \n\
";
