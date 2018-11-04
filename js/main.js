(function() {
// REF: https://threejs.org/examples/#webgl_custom_attributes
// TODO:
//    o Implement crumple
//    o Combine displacement attributes
//    o Replace UV with pic/something else
//    o Tweak edge and/or blur?
//    o Expose paper size/shape/segments in inputs?
//    o Tweak paper frag?
//    o Switch between linear and nearest filters on temp targets?
//    o Smarter normals? (octahedron encoding + float32 --> int8,8)
//    o Expose edge thickness control?
//    o Fix edge center shadow
//    o Combine event handlers
//    o Framerate???

//////////////////////////////////////////////////////////////////
// INIT //////////////////////////////////////////////////////////
function initInputs() {
  _inputs = {
    visualizePass: 'final'
  };

  var gui = new dat.GUI();
  gui.add(_inputs, 'visualizePass', ['normals', 'edges', 'blur1', 'blur2', 'composite', 'final']);
}

function initCameras() {
  _paperOrthoCamera = new THREE.OrthographicCamera(-HALF_PAPER_SIZE, HALF_PAPER_SIZE, HALF_PAPER_SIZE, -HALF_PAPER_SIZE, 1, 10000);
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
  _paperGeometry = new THREE.PlaneBufferGeometry(PAPER_SIZE, PAPER_SIZE, PAPER_SEGMENTS, PAPER_SEGMENTS);
  _startDisplacement = new Float32Array(_paperGeometry.attributes.position.count * 3);
  _endDisplacement = new Float32Array(_paperGeometry.attributes.position.count * 3);
  _paperGeometry.addAttribute('aDisplacementStart', new THREE.BufferAttribute(_startDisplacement, 3));
  _paperGeometry.addAttribute('aDisplacementEnd', new THREE.BufferAttribute(_endDisplacement, 3));
  _paperMesh = new THREE.Mesh(_paperGeometry, _normalsPassMaterial);
  _paperScene.add(_paperMesh);

  _fullScreenQuadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), _edgesPassMaterial);
  _fullScreenQuadScene.add(_fullScreenQuadMesh);

  _axisGeometry = new THREE.BufferGeometry().setFromPoints([[0, 0, 0], [0, 0, 0]]);
  _axisMesh = new THREE.Line(_axisGeometry, new THREE.LineDashedMaterial({color: 0x88ff88, dashSize: 1, gapSize: 1 }));
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
  window.addEventListener('mouseup', fold);
  window.addEventListener('keypress', unfold);
  window.addEventListener('mousedown', updateAxis);
  window.addEventListener('mousemove', updateAxis);
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

var updateAxis = (function() {
  var axisSeg = [];
  return function(evt) {
    axisSeg[0] = _inputState.lastMouseDownPosition;
    axisSeg[1] = _inputState.lastMouseMovePosition;
    _axisGeometry.setFromPoints(axisSeg);
    _axisMesh.computeLineDistances();
  };
})();

var fold = (function() {
  var paperPos = new THREE.Vector3();
  var foldVec = new THREE.Vector3();
  var tempVec1 = new THREE.Vector3();
  var tempVec2 = new THREE.Vector3();

  return function(evt) {
    if (!validateMouseEvent(evt)) return true;
    // REF: https://math.stackexchange.com/questions/65503/point-reflection-over-a-line
    foldVec.copy(_inputState.lastMouseUpPosition).sub(_inputState.lastMouseDownPosition)
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
      tempVec1.copy(foldVec).cross(tempVec2.copy(paperPos).sub(_inputState.lastMouseDownPosition));
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
    }
    startAnimating();
    return true;
  };
})();

function unfold(evt) {
  if (evt.key !== ' ') return;
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
  _renderer.render(_fullScreenQuadScene, _fullScreenQuadOrthoCamera, _foldAccumulationTarget, false);
  if (_inputs.visualizePass === 'blur2') return displayTarget(_foldAccumulationTarget);

  _fullScreenQuadMesh.material = _uvPassMaterial;
  _renderer.render(_fullScreenQuadScene, _fullScreenQuadOrthoCamera, _tempTargetA, true);

  _fullScreenQuadMesh.material = _foldPassMaterial;
  _foldPassMaterial.uniforms.uSource.value = _foldAccumulationTarget.texture;
  _renderer.render(_fullScreenQuadScene, _fullScreenQuadOrthoCamera, _tempTargetA, false);
  if (_inputs.visualizePass === 'composite') return displayTarget(_tempTargetA);

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
  initCameras();
  initControls();
  initScenes();
  initTargets();
  initMaterials();
  initMeshes();
  initRenderer();
  initWindow();
}

// Shared local variables
// settings
var PAPER_SIZE = 120;
var PAPER_SEGMENTS = 400;
var HALF_PAPER_SIZE = PAPER_SIZE / 2;
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
var _paperGeometry,
    _axisGeometry,
    _startDisplacement,
    _endDisplacement,
    _animationStartTime;
// rendering
var _renderer;
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
// materials
var _normalsPassMaterial,
    _edgesPassMaterial,
    _blurPassMaterial,
    _uvPassMaterial,
    _foldPassMaterial,
    _paperPassMaterial;
// targets
var _tempTargetA,
    _tempTargetB,
    _foldAccumulationTarget;

init();
tick();

})();