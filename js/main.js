(function() {
// REF: https://threejs.org/examples/#webgl_custom_attributes
// TODO:
//    o Some sorta crumple?
//    o Framerate/Usage??????????????????????????????????
//    o Real finer paper pass w lighting affected by folds
//    o Conditionally update uniforms etc
//    o Combine event handlers?
//    o Combine displacement attributes?
//    o Mention CONTROLS/shift+click+drag to rotate somewhere
//    o Optimize image loading

//////////////////////////////////////////////////////////////////
// INIT //////////////////////////////////////////////////////////
function initInputs() {
  _inputs = {
    visualizePass: 'final',
    paperSize: 'square',
    paperTexture: 'courtyard',
    showUV: false,
    frequencyFundamental: 4,
    frequencyRange: MAX_FREQUENCY_RANGE,
    stopAudio: stopAudio.bind(null, null, true),
    unfold: unfoldPaper.bind(null, null, true),
    reset: resetPaperAudio.bind(null, null, true)
  };

  var gui = new dat.GUI();
  gui.add(_inputs, 'visualizePass', ['normals', 'edges', 'blur1', 'blur2', 'composite', 'final']);
  gui.add(_inputs, 'paperSize', ['square', 'postcard', '8.5x11']).onChange(resetPaper);
  gui.add(_inputs, 'paperTexture', ['courtyard', 'blue_wall', 'house']).onChange(function(val) { initTextures(); _paperTexturePassMaterial.uniforms.uSource.value = _paperTexture; });
  gui.add(_inputs, 'showUV');
  gui.add(_inputs, 'frequencyFundamental', 2, 110).step(1).onChange(function(val) { if (_oscillator) _oscillator.frequency.value = val; });
  gui.add(_inputs, 'frequencyRange', 2, MAX_FREQUENCY_RANGE).step(1);
  gui.add(_inputs, 'stopAudio');
  gui.add(_inputs, 'unfold');
  gui.add(_inputs, 'reset');
}

function initPaperSize() {
  switch(_inputs.paperSize) {
    case 'square':
      _paperSizeX = 120;
      _paperSizeY = 120;
      break;
    case 'postcard':
      _paperSizeX = 148;
      _paperSizeY = 106;
      break;
    case '8.5x11':
      _paperSizeX = 108;
      _paperSizeY = 140;
      break;
  }
  _halfPaperSizeX = _paperSizeX / 2;
  _halfPaperSizeY = _paperSizeY / 2;
  _paperDiagonal = Math.sqrt(_paperSizeX * _paperSizeX + _paperSizeY * _paperSizeY);
}

function initCameras() {
  _paperOrthoCamera = new THREE.OrthographicCamera(-_halfPaperSizeX, _halfPaperSizeX, _halfPaperSizeY, -_halfPaperSizeY, 1, 10000);
  _paperOrthoCamera.position.z = 300;

  _paperPerspectiveCamera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 10000);
  _paperPerspectiveCamera.position.z = 300;

  _fullScreenQuadOrthoCamera = new THREE.OrthographicCamera();
}

function initControls() {
  _paperPerspectiveOrbitControls = new THREE.OrbitControls(_paperPerspectiveCamera);
  _paperPerspectiveOrbitControls.update();
}

function initScenes() {
  _paperScene = new THREE.Scene();
  _fullScreenQuadScene = new THREE.Scene();
}

function initTargets() {
  // NOTE: These temps only need to be linear for the two blur passes but I dont think it messes anything up to have them linear the whole time?
  _tempTargetA = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
  _tempTargetB = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
  _foldAccumulationTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
}

function initTextures() {
  _paperTexture = new THREE.TextureLoader().load('assets/' + _inputs.paperTexture + '.JPG');
  _paperTexture.flipY = false;
}

function initMaterials() {
  // NOTE: Assumes shaders are in global scope
  _normalsPassMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uShouldDistort: { value: 0.0 },
      uTime: { value: 0.0 }
    },
    vertexShader:paper_vert,
    fragmentShader: normals_frag,
    extensions: {
      derivatives: true
    }
  });

  _edgesPassMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uInverseResolution: { value: new THREE.Vector2(1 / window.innerWidth, 1 / window.innerHeight) },
      uNormals: { value: _tempTargetA.texture }
    },
    vertexShader: fullScreenQuad_vert,
    fragmentShader: edges_frag
  });

  _blurPassMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uInverseResolution: { value: new THREE.Vector2(1 / window.innerWidth, 1 / window.innerHeight) },
      uDir: { value: new THREE.Vector2(1, 0) },
      uSource: { value: _tempTargetB.texture }
    },
    vertexShader: fullScreenQuad_vert,
    fragmentShader: blur_frag
  });

  _uvPassMaterial = new THREE.ShaderMaterial({
    uniforms: {
    },
    vertexShader: fullScreenQuad_vert,
    fragmentShader: displayUV_frag
  });

  _paperTexturePassMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSource: { value: _paperTexture }
    },
    vertexShader: fullScreenQuad_vert,
    fragmentShader: displayTexture_frag
  });

  _foldPassMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSource: { value: _foldAccumulationTarget.texture }
    },
    vertexShader: fullScreenQuad_vert,
    fragmentShader: displayTexture_frag,
    blending: THREE.AdditiveBlending
  });

  _paperPassMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uShouldDistort: { value: 1.0 },
      uSource: { value: _tempTargetA.texture },
      uTime: { value: 0.0 }
    },
    vertexShader: paper_vert,
    fragmentShader: paper_frag,
    extensions: {
      derivatives: true
    },
    side: THREE.DoubleSide
  });
}

function initMeshes() {
  _paperGeometry = new THREE.PlaneBufferGeometry(_paperSizeX, _paperSizeY, PAPER_SEGMENTS, PAPER_SEGMENTS);
  _vertCount = _paperGeometry.attributes.position.count;
  _startDisplacement = new Float32Array(_vertCount * 3);
  _endDisplacement = new Float32Array(_vertCount * 3);
  _paperGeometry.addAttribute('aDisplacementStart', new THREE.BufferAttribute(_startDisplacement, 3));
  _paperGeometry.addAttribute('aDisplacementEnd', new THREE.BufferAttribute(_endDisplacement, 3));
  _paperMesh = new THREE.Mesh(_paperGeometry, _normalsPassMaterial);
  _paperScene.add(_paperMesh);

  _fullScreenQuadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), _edgesPassMaterial);
  _fullScreenQuadScene.add(_fullScreenQuadMesh);

  _axisGeometry = new THREE.BufferGeometry().setFromPoints([[0, 0, 0], [0, 0, 0]]);
  _axisMesh = new THREE.Line(_axisGeometry, new THREE.LineDashedMaterial({color: 0x88ff88, dashSize: 1, gapSize: 1 }));
  // _axisMesh = new THREE.Line(_axisGeometry, new THREE.LineBasicMaterial({color: 0x88ff88, dashSize: 1, gapSize: 1 }));
  _axisMesh.computeLineDistances();
}

function initRenderer() {
  _renderer = new THREE.WebGLRenderer();
  _renderer.setPixelRatio(window.devicePixelRatio);
  _renderer.setSize(window.innerWidth, window.innerHeight);
  _renderer.autoClear = false;
}

function initWindow() {
  var container = document.getElementById('container');
  container.appendChild(_renderer.domElement);

  window.addEventListener('resize', onWindowResize, false);
  window.addEventListener('mousedown', trackMouseEvent.bind(null, 'lastMouseDownPosition'));
  window.addEventListener('mouseup', trackMouseEvent.bind(null, 'lastMouseUpPosition'));
  window.addEventListener('mousemove', trackMouseEvent.bind(null, 'lastMouseMovePosition'));
  window.addEventListener('mouseup', foldPaper);
  window.addEventListener('keypress', unfoldPaper);
  window.addEventListener('mousedown', updateAxis);
  window.addEventListener('mousemove', updateAxis);
  window.addEventListener('keypress', stopAudio);
}

function initAudio() {
  _realFrequencies = new Float32Array(MAX_FREQUENCY_RANGE + 1);
  _imaginaryFrequencies = new Float32Array(MAX_FREQUENCY_RANGE + 1);
  _audioContext = new AudioContext();

  // Noise
  // These numbers are all completely made up
  var noiseBuffer = _audioContext.createBuffer(1, 0.3 * _audioContext.sampleRate, _audioContext.sampleRate);
  var channelData = noiseBuffer.getChannelData(0);
  for (var i = 0, len = channelData.length; i < len; i++) {
    channelData[i] = (Math.random() * 2 - 1) * (Math.sin(2 * Math.PI * i / channelData.length) * 0.5 + 0.5 + 2.0);
  }
  _noise = _audioContext.createBufferSource();
  _noise.buffer = noiseBuffer;
  _noise.loop = true;
  _noise.start(0);
  var noiseGain = _audioContext.createGain();
  noiseGain.gain.value = 0.001;
  _noise.connect(noiseGain);
  _noise = noiseGain;
}
// INIT //////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////
// EVENT HANDLERS AND ANIMATION //////////////////////////////////
function onWindowResize() {
  // Cameras
  _paperPerspectiveCamera.aspect = window.innerWidth / window.innerHeight;
  _paperPerspectiveCamera.updateProjectionMatrix();
  _paperPerspectiveOrbitControls.update();
  _paperOrthoCamera.aspect = window.innerWidth / window.innerHeight;
  _paperOrthoCamera.updateProjectionMatrix();
  _fullScreenQuadOrthoCamera.aspect = window.innerWidth / window.innerHeight;
  _fullScreenQuadOrthoCamera.updateProjectionMatrix();

  // Targets
  _tempTargetA.setSize(window.innerWidth, window.innerHeight);
  _tempTargetB.setSize(window.innerWidth, window.innerHeight);
  _foldAccumulationTarget.setSize(window.innerWidth, window.innerHeight);

  // Uniforms
  _edgesPassMaterial.uniforms.uInverseResolution.value = new THREE.Vector2(1 / window.innerWidth, 1 / window.innerHeight);
  _blurPassMaterial.uniforms.uInverseResolution.value = new THREE.Vector2(1 / window.innerWidth, 1 / window.innerHeight);

  // Renderer
  _renderer.setSize(window.innerWidth, window.innerHeight);
}

function validateMouseEvent(evt) {
  return (evt.target.tagName === 'CANVAS' && !evt.shiftKey);
}

function trackMouseEvent(stateProperty, evt) {
  if (!validateMouseEvent(evt)) return true;
  _inputState.lmbDown = evt.buttons > 0 && (evt.buttons % 2 === 1);
  // REF: https://stackoverflow.com/questions/13055214/mouse-canvas-x-y-to-three-js-world-x-y-z
  _inputState.lastEventRay.set((evt.clientX / window.innerWidth) * 2 - 1, -(evt.clientY / window.innerHeight) * 2 + 1, 0.5);
  _inputState.lastEventRay.unproject(_paperPerspectiveCamera);
  _inputState.lastEventRay.sub(_paperPerspectiveCamera.position).normalize();
  var distanceToZPlane = -_paperPerspectiveCamera.position.z / _inputState.lastEventRay.z;
  _inputState[stateProperty].copy(_paperPerspectiveCamera.position).add(_inputState.lastEventRay.multiplyScalar(distanceToZPlane));
  return true;
}

function resetPaper() {
  resetPaperAudio(null, true);
  initPaperSize();
  initCameras();
  initControls();
  _paperScene.remove(_paperMesh);
  _fullScreenQuadScene.remove(_fullScreenQuadMesh);
  initMeshes();
}

function resetPaperAudio(evt, force) {
  if (!force) return;
  // reset audio
  stopAudio(null, true);
  for (var i = 0; i < MAX_FREQUENCY_RANGE; i++) {
    _imaginaryFrequencies[i] = 0;
    _realFrequencies[i] = 0;
  }

  // clear fold marks
  _forceClear = true;
  setTimeout(function() {
    _forceClear = false;
  }, 1000);

  // unfold paper
  unfoldPaper(null, true);
}

function stopAudio(evt, force) {
  if ((evt && evt.key === 'm') || force) fadeAudio(_oscillator);
}

function fadeAudio(startSrc, endSrc, duration) {
  duration = duration || 1;

  if (startSrc) {
    startGain = _audioContext.createGain();
    startGain.gain.value = 1;
    startSrc.disconnect();
    startSrc.connect(startGain);
    startGain.connect(_audioContext.destination);
    startGain.gain.linearRampToValueAtTime(0.00001, _audioContext.currentTime + duration);
  }

  if (endSrc) {
    endGain = _audioContext.createGain();
    endGain.gain.value = 0;
    endSrc.disconnect();
    endSrc.connect(endGain);
    endGain.connect(_audioContext.destination);
    endGain.gain.linearRampToValueAtTime(1.0, _audioContext.currentTime + duration);
    _noise.connect(_audioContext.destination);
  }

  setTimeout(function() {
    if (startSrc) {
      startSrc.stop(0);
      startSrc.disconnect();
      startGain.disconnect();
      if (!endSrc) _noise.disconnect();
    }
  }, duration * 1000);
}

function foldAudio(freq) {
  if (freq === 0) return;
  freq = freq * (_inputs.frequencyRange - 1);
  var freqFloor = Math.floor(freq);
  var freqFrac = freq - freqFloor;
  _imaginaryFrequencies[freqFloor + 1] += 1 - freqFrac;
  _realFrequencies[freqFloor + 2] += freqFrac; // TODO: does this vs imag matter?
  var wave = _audioContext.createPeriodicWave(_realFrequencies, _imaginaryFrequencies, {disableNormalization: false});

  var oldOscillator = _oscillator;
  _oscillator = _audioContext.createOscillator();
  _oscillator.frequency.value = _inputs.frequencyFundamental;
  _oscillator.setPeriodicWave(wave);
  _oscillator.connect(_audioContext.destination);
  _oscillator.start(0);
  fadeAudio(oldOscillator, _oscillator);
}

var updateAxis = (function() {
  var axisSeg = [];
  return function(evt) {
    axisSeg[0] = _inputState.lastMouseDownPosition;
    axisSeg[1] = _inputState.lastMouseMovePosition;
    _axisGeometry.setFromPoints(axisSeg);
    _axisMesh.computeLineDistances();
  };
})();

function unfoldPaper(evt, force) {
  if ((evt && evt.key !== ' ') && !force) return;
  for (var i = 0; i < (_startDisplacement.length - 2); i += 3) {
    _startDisplacement[i + 0] = _endDisplacement[i + 0];
    _startDisplacement[i + 1] = _endDisplacement[i + 1];
    _startDisplacement[i + 2] = _endDisplacement[i + 2];
    _endDisplacement[i + 0] = 0;
    _endDisplacement[i + 1] = 0;
    _endDisplacement[i + 2] = 0;
  }
  startAnimating();
  return true;
}

var foldPaper = (function() {
  var paperPos = new THREE.Vector3();
  var foldVec = new THREE.Vector3();
  var tempVec1 = new THREE.Vector3();
  var tempVec2 = new THREE.Vector3();

  return function(evt) {
    if (!validateMouseEvent(evt)) return true;

    foldVec.copy(_inputState.lastMouseUpPosition).sub(_inputState.lastMouseDownPosition);
    if (foldVec.length() < 0.1) return true;

    // For tracking the crease
    var vertsCreased = 0;
    var creaseMinX = Infinity;
    var creaseMinY = Infinity;
    var creaseMaxX = -Infinity;
    var creaseMaxY = -Infinity;

    // REF: https://math.stackexchange.com/questions/65503/point-reflection-over-a-line
    var a = (foldVec.x * foldVec.x - foldVec.y * foldVec.y) / (foldVec.x * foldVec.x + foldVec.y * foldVec.y);
    var b = 2 * foldVec.x * foldVec.y / (foldVec.x * foldVec.x + foldVec.y * foldVec.y);

    for (var i = 0; i < (_endDisplacement.length - 2); i += 3) {
      // Reset start and end displacements
      _startDisplacement[i + 0] = _endDisplacement[i + 0];
      _startDisplacement[i + 1] = _endDisplacement[i + 1];
      _startDisplacement[i + 2] = _endDisplacement[i + 2];

      // Get current paper position
      paperPos.set(_paperGeometry.attributes.position.array[i + 0] + _startDisplacement[i + 0],
                   _paperGeometry.attributes.position.array[i + 1] + _startDisplacement[i + 1],
                   _paperGeometry.attributes.position.array[i + 2] + _startDisplacement[i + 2]);

      // Check winding
      tempVec1.copy(foldVec).normalize().cross(tempVec2.copy(paperPos).sub(_inputState.lastMouseDownPosition));
      if (tempVec1.z > 0) {
        // Flip one side
        var newX = a * (paperPos.x - _inputState.lastMouseDownPosition.x) + b * (paperPos.y - _inputState.lastMouseDownPosition.y) + _inputState.lastMouseDownPosition.x;
        var newY = b * (paperPos.x - _inputState.lastMouseDownPosition.x) - a * (paperPos.y - _inputState.lastMouseDownPosition.y) + _inputState.lastMouseDownPosition.y;
        _endDisplacement[i + 0] += newX - paperPos.x;
        _endDisplacement[i + 1] += newY - paperPos.y;
        _endDisplacement[i + 2] += 0.0;
      } else {
        _startDisplacement[i + 2] -= 0.1;
        _endDisplacement[i + 2] -= 0.1;
      }

      // Count creased verts
      if (Math.abs(tempVec1.z) < 1) {
        vertsCreased++;
        creaseMinX = Math.min(creaseMinX, paperPos.x);
        creaseMinY = Math.min(creaseMinY, paperPos.y);
        creaseMaxX = Math.max(creaseMaxX, paperPos.x);
        creaseMaxY = Math.max(creaseMaxY, paperPos.y);
      }
    }

    // Animate
    startAnimating();

    // Audiate
    var creaseDX = creaseMaxX - creaseMinX;
    var creaseDY = creaseMaxY - creaseMinY;
    var creaseDiagonal = Math.sqrt(creaseDX * creaseDX + creaseDY * creaseDY)
    // TODO: tweke these more?
    foldAudio(0.8 * (vertsCreased / _vertCount) + 0.2 * (1 - (creaseDiagonal / _paperDiagonal)));

    return true;
  };
})();

function startAnimating() {
  _animationStartTime = Date.now();
  _paperMesh.geometry.attributes.aDisplacementStart.needsUpdate = true;
  _paperMesh.geometry.attributes.aDisplacementEnd.needsUpdate = true;
}
// EVENT HANDLERS AND ANIMATION //////////////////////////////////
//////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////
// RENDERING /////////////////////////////////////////////////////
function displayTarget(target) {
  _fullScreenQuadMesh.material = _foldPassMaterial;
  _foldPassMaterial.uniforms.uSource.value = target.texture;
  _renderer.render(_fullScreenQuadScene, _fullScreenQuadOrthoCamera, null, true);
}

function render() {
  // Setup
  _renderer.setClearColor(new THREE.Color(0x000000), 0);
  var currentTime = Date.now();
  var animationDeltaTime = Math.min((currentTime - (_animationStartTime || currentTime)) * 0.001, 1);

  // Passes
  _paperMesh.material = _normalsPassMaterial;
  _normalsPassMaterial.uniforms.uTime.value = animationDeltaTime;
  _paperScene.remove(_axisMesh);
  _renderer.render(_paperScene, _paperOrthoCamera, _tempTargetA, true);
  if (_inputs.visualizePass === 'normals') return displayTarget(_tempTargetA);

  _fullScreenQuadMesh.material = _edgesPassMaterial;
  _edgesPassMaterial.uniforms.uNormals.value = _tempTargetA.texture;
  _renderer.render(_fullScreenQuadScene, _fullScreenQuadOrthoCamera, _tempTargetB, true);
  if (_inputs.visualizePass === 'edges') return displayTarget(_tempTargetB);

  _fullScreenQuadMesh.material = _blurPassMaterial;
  _blurPassMaterial.uniforms.uDir.value = HORIZONTAL_DIR;
  _blurPassMaterial.uniforms.uSource.value = _tempTargetB.texture;
  _blurPassMaterial.blending = THREE.NoBlending;
  _renderer.render(_fullScreenQuadScene, _fullScreenQuadOrthoCamera, _tempTargetA, true);
  if (_inputs.visualizePass === 'blur1') return displayTarget(_tempTargetA);

  _fullScreenQuadMesh.material = _blurPassMaterial;
  _blurPassMaterial.uniforms.uDir.value = VERTICAL_DIR;
  _blurPassMaterial.uniforms.uSource.value = _tempTargetA.texture;
  _blurPassMaterial.blending = THREE.CustomBlending;
  _blurPassMaterial.blendEquation = THREE.MaxEquation;
  _blurPassMaterial.blendSrc = THREE.OneFactor;
  _blurPassMaterial.blendDst = THREE.OneFactor;
  _renderer.render(_fullScreenQuadScene, _fullScreenQuadOrthoCamera, _foldAccumulationTarget, _forceClear);
  if (_inputs.visualizePass === 'blur2') return displayTarget(_foldAccumulationTarget);

  _fullScreenQuadMesh.material = _inputs.showUV ? _uvPassMaterial : _paperTexturePassMaterial;
  _renderer.render(_fullScreenQuadScene, _fullScreenQuadOrthoCamera, _tempTargetA, true);

  _fullScreenQuadMesh.material = _foldPassMaterial;
  _foldPassMaterial.uniforms.uSource.value = _foldAccumulationTarget.texture;
  _renderer.render(_fullScreenQuadScene, _fullScreenQuadOrthoCamera, _tempTargetA, false);
  if (_inputs.visualizePass === 'composite') return displayTarget(_tempTargetA);

  // TODO: The to-screen pass seems to destroy performance???
  _paperMesh.material = _paperPassMaterial;
  _paperPassMaterial.uniforms.uSource.value = _tempTargetA.texture;
  _paperPassMaterial.uniforms.uTime.value = animationDeltaTime;
  if (_inputState.lmbDown) _paperScene.add(_axisMesh);
  _renderer.setClearColor(new THREE.Color(0x000000), 1);
  _renderer.render(_paperScene, _paperPerspectiveCamera, null, true);
}
// RENDERING /////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////

function tick() {
  requestAnimationFrame(tick);
  render();
}

function init() {
  initInputs();
  initPaperSize();
  initCameras();
  initControls();
  initScenes();
  initTargets();
  initTextures();
  initMaterials();
  initMeshes();
  initRenderer();
  initWindow();
  initAudio();
}

// Shared local variables
// settings
var PAPER_SEGMENTS = 400;
var MAX_FREQUENCY_RANGE = 400;
// util constants
var HORIZONTAL_DIR = new THREE.Vector2(1, 0);
var VERTICAL_DIR = new THREE.Vector2(0, 1);

// input variables
var _inputs;
// animation and control
var _inputState = {
  lastEventRay: new THREE.Vector3(),
  lastMouseDownPosition: new THREE.Vector3(),
  lastMouseUpPosition: new THREE.Vector3(),
  lastMouseMovePosition: new THREE.Vector3(),
  lmbDown: false
};
var _paperSizeX,
    _paperSizeY,
    _halfPaperSizeX,
    _halfPaperSizeY,
    _paperDiagonal,
    _vertCount,
    _paperGeometry,
    _axisGeometry,
    _startDisplacement,
    _endDisplacement,
    _animationStartTime;
// rendering
var _renderer,
    _forceClear = false;
// paper
var _paperMesh,
    _axisMesh,
    _paperScene,
    _paperOrthoCamera,
    _paperPerspectiveCamera,
    _paperPerspectiveOrbitControls;
// billboard
var _fullScreenQuadMesh,
    _fullScreenQuadScene,
    _fullScreenQuadOrthoCamera;
// textures
var _paperTexture;
// materials
var _normalsPassMaterial,
    _edgesPassMaterial,
    _blurPassMaterial,
    _uvPassMaterial,
    _paperTexturePassMaterial,
    _foldPassMaterial,
    _paperPassMaterial;
// targets
var _tempTargetA,
    _tempTargetB,
    _foldAccumulationTarget;
// audio
var _audioContext,
    _oscillator,
    _realFrequencies,
    _imaginaryFrequencies,
    _noise;

init();
tick();

})();