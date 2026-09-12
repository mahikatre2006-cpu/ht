import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Helper to compute exact world position and close-up camera vectors for the CRT screen
function computeScreenCameraCoords(isMobile) {
  const modelGroup = new THREE.Group()
  modelGroup.position.set(isMobile ? -0.5 : -1.1, isMobile ? -0.9 : -1.4, 0)
  const s = isMobile ? 0.105 : 0.14
  modelGroup.scale.set(s, s, s)
  modelGroup.rotation.y = Math.PI

  const screenGroup = new THREE.Group()
  screenGroup.position.set(-22, 11, 2)
  screenGroup.rotation.y = Math.PI - 0.735

  const geom = new THREE.PlaneGeometry(1, 1)
  const screenMesh = new THREE.Mesh(geom)
  screenMesh.scale.set(10.15, 7.875, 1)
  screenMesh.position.set(-0.2, -0.55, 0.1)
  screenMesh.rotation.x = -0.07

  screenGroup.add(screenMesh)
  modelGroup.add(screenGroup)
  modelGroup.updateMatrixWorld(true)

  const worldPos = new THREE.Vector3()
  screenMesh.getWorldPosition(worldPos)

  const worldDir = new THREE.Vector3()
  screenMesh.getWorldDirection(worldDir)

  const worldHeight = 7.875 * s
  const fovRad = (50 * Math.PI) / 180
  const dist = (worldHeight / (2 * Math.tan(fovRad / 2))) * (isMobile ? 1.15 : 1.28)

  const camPos = worldPos.clone().addScaledVector(worldDir, dist)
  geom.dispose()

  return { worldPos, camPos }
}

// Helper to generate a soft, high-resolution procedural light pool texture
function createLightPoolTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const center = size / 2
  const gradient = ctx.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center
  )
  gradient.addColorStop(0.0, 'rgba(255, 228, 195, 0.48)') // Warm soft golden pool under PC
  gradient.addColorStop(0.22, 'rgba(220, 190, 160, 0.28)')
  gradient.addColorStop(0.48, 'rgba(90, 75, 95, 0.08)') // Muted subtle transition
  gradient.addColorStop(0.75, 'rgba(25, 20, 30, 0.02)')
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Helper to generate a feathered contact shadow texture to anchor the PC and keyboard
function createContactShadowTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const center = size / 2
  const gradient = ctx.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center
  )
  gradient.addColorStop(0.0, 'rgba(0, 0, 0, 0.96)') // Deep dark contact occlusion
  gradient.addColorStop(0.35, 'rgba(0, 0, 0, 0.75)')
  gradient.addColorStop(0.72, 'rgba(0, 0, 0, 0.25)')
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Helper to generate an organic, soft volumetric smoke puff texture
function createSmokeParticleTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const center = size / 2
  ctx.fillStyle = 'rgba(0, 0, 0, 0)'
  ctx.fillRect(0, 0, size, size)

  // Multi-layered soft Gaussian blobs to simulate natural smoke puff contours
  const blobs = [
    { x: center, y: center, r: center * 0.88, a: 0.32 },
    { x: center * 0.82, y: center * 0.86, r: center * 0.65, a: 0.24 },
    { x: center * 1.18, y: center * 0.94, r: center * 0.70, a: 0.26 },
    { x: center * 0.96, y: center * 1.16, r: center * 0.65, a: 0.22 },
    { x: center * 1.08, y: center * 0.78, r: center * 0.55, a: 0.20 },
  ]

  blobs.forEach((b) => {
    const radGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
    radGrad.addColorStop(0.0, `rgba(255, 255, 255, ${b.a})`)
    radGrad.addColorStop(0.45, `rgba(255, 255, 255, ${b.a * 0.55})`)
    radGrad.addColorStop(0.8, `rgba(255, 255, 255, ${b.a * 0.15})`)
    radGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0)')

    ctx.fillStyle = radGrad
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fill()
  })

  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

// Helper to generate the custom "Hackstreak 3.0" computer badge texture
function createHackstreakLogoTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 415
  const ctx = canvas.getContext('2d')

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false

  const drawBadge = () => {
    // 1. Solid pure matte black background (completely removes old rainbow logo and text)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Shared bold retro-tech typography matching 3.0
    const fontBase = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    const targetFontSize = 88

    // 2. Draw "Hackstreak" on the left badge (logo removed, font size matching 3.0)
    let leftFontSize = targetFontSize
    ctx.font = `900 ${leftFontSize}px ${fontBase}`
    while (ctx.measureText('Hackstreak').width > 470 && leftFontSize > 50) {
      leftFontSize -= 2
      ctx.font = `900 ${leftFontSize}px ${fontBase}`
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Drop shadow
    ctx.fillStyle = '#222222'
    ctx.fillText('Hackstreak', 284, 281)

    // Main crisp white text
    ctx.fillStyle = '#ffffff'
    ctx.fillText('Hackstreak', 280, 277)

    // 3. Draw "3.0" on the right badge with matching bold typography
    ctx.font = `900 ${targetFontSize}px ${fontBase}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Drop shadow
    ctx.fillStyle = '#222222'
    ctx.fillText('3.0', 734, 109)

    // Main crisp white text
    ctx.fillStyle = '#ffffff'
    ctx.fillText('3.0', 730, 105)

    texture.needsUpdate = true
  }

  // Draw immediately and refresh if fonts finish loading
  drawBadge()
  if (document.fonts) {
    document.fonts.ready.then(drawBadge).catch(() => {})
  }

  return texture
}

export default function App() {
  const scrollContainerRef = useRef(null)
  const canvasRef = useRef(null)
  const loadingOverlayRef = useRef(null)
  const loadingCanvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Custom Hackstreak 3.0 badge texture
    const hackstreakLogoTexture = createHackstreakLogoTexture()

    // 1. Three.js Scene Setup (aligned model layout)
    const scene = new THREE.Scene()
    // Pure pitch black background
    scene.background = new THREE.Color(0x000000)

    // Camera sits right at its resting overview position ("let the pc be at its place")
    const cameraState = {
      posX: 0,
      posY: 0.2,
      posZ: 4.5,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
      parallaxWeight: 0, // Parallax activates once the loading screen finishes
    }

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    camera.position.set(cameraState.posX, cameraState.posY, cameraState.posZ)
    camera.lookAt(cameraState.targetX, cameraState.targetY, cameraState.targetZ)

    let introFinished = false
    let scrollTriggerInstance = null

    // ScrollTrigger setup: links page scrolling to smooth camera zoom
    const setupScrollTrigger = () => {
      const scrollEl = scrollContainerRef.current
      if (!scrollEl) return

      scrollTriggerInstance = ScrollTrigger.create({
        scroller: scrollEl,
        trigger: scrollEl,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.2,
        onUpdate: (self) => {
          if (!introFinished) return
          const p = self.progress
          const isMobile = window.innerWidth <= 1024
          const coords = computeScreenCameraCoords(isMobile)

          cameraState.posX = gsap.utils.interpolate(0, coords.camPos.x, p)
          cameraState.posY = gsap.utils.interpolate(0.2, coords.camPos.y, p)
          cameraState.posZ = gsap.utils.interpolate(4.5, coords.camPos.z, p)
          cameraState.targetX = gsap.utils.interpolate(0, coords.worldPos.x, p)
          cameraState.targetY = gsap.utils.interpolate(0, coords.worldPos.y, p)
          cameraState.targetZ = gsap.utils.interpolate(0, coords.worldPos.z, p)
          cameraState.parallaxWeight = gsap.utils.interpolate(1, 0, p)
        },
      })
    }

    // Retro CRT Loading Screen Overlay Handler
    const baseImg = new Image()
    baseImg.src = '/loading-base.png'

    const loadingState = { progress: 0 }

    const renderLoading = () => {
      const lCanvas = loadingCanvasRef.current
      if (!lCanvas) return
      const ctx = lCanvas.getContext('2d')
      if (!ctx) return

      // Draw base CRT screen if image loaded
      if (baseImg.complete && baseImg.naturalWidth > 0) {
        ctx.drawImage(baseImg, 0, 0, 1024, 530)
      }

      // Draw animated progress blocks inside the border box
      const filled = Math.min(20, Math.floor((loadingState.progress / 100) * 20))
      const startX = 321
      const startY = 348
      const blockW = 14
      const blockH = 30
      const gap = 5.4

      ctx.fillStyle = '#e4dccd'
      for (let i = 0; i < filled; i++) {
        const bx = Math.round(startX + i * (blockW + gap))
        ctx.fillRect(bx, startY, blockW, blockH)
      }
    }

    baseImg.onload = renderLoading
    if (baseImg.complete) renderLoading()

    // Animate progress bar from 0% to 100%
    const loadingTween = gsap.to(loadingState, {
      progress: 100,
      duration: 2.2,
      ease: 'power1.inOut',
      onUpdate: renderLoading,
      onComplete: () => {
        // Pause briefly at 100% before smoothly fading out to reveal the PC
        gsap.delayedCall(0.35, () => {
          if (loadingOverlayRef.current) {
            gsap.to(loadingOverlayRef.current, {
              opacity: 0,
              duration: 0.85,
              ease: 'power2.out',
              onComplete: () => {
                if (loadingOverlayRef.current) {
                  loadingOverlayRef.current.style.display = 'none'
                }
                introFinished = true
                cameraState.parallaxWeight = 1
                setupScrollTrigger()
              },
            })
          } else {
            introFinished = true
            cameraState.parallaxWeight = 1
            setupScrollTrigger()
          }
        })
      },
    })

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.22
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Pure black atmospheric fog to dissolve all background edges deeply into pitch black smoke
    scene.fog = new THREE.FogExp2(0x000000, 0.058)

    // Deep, minimal ambient light so background and shadows stay completely dark
    const ambientLight = new THREE.AmbientLight(0x040306, 0.22)
    scene.add(ambientLight)

    // Dedicated bright Studio Spotlight focused directly on the PC model
    const pcSpotlight = new THREE.SpotLight(0xfff0dd, 18.0, 25.0, 0.65, 0.45, 1.1)
    pcSpotlight.position.set(2.8, 6.5, 4.2)
    pcSpotlight.target.position.set(1.92, -0.3, -0.3)
    pcSpotlight.castShadow = true
    pcSpotlight.shadow.mapSize.width = 2048
    pcSpotlight.shadow.mapSize.height = 2048
    pcSpotlight.shadow.camera.near = 0.5
    pcSpotlight.shadow.camera.far = 15
    pcSpotlight.shadow.bias = -0.0005
    scene.add(pcSpotlight)
    scene.add(pcSpotlight.target)

    // Warm golden key light focused on the computer chassis and keyboard deck
    const keyLight = new THREE.DirectionalLight(0xffe2bf, 4.2)
    keyLight.position.set(4.8, 5.8, 4.5)
    keyLight.target.position.set(1.92, -0.3, -0.3)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 2048
    keyLight.shadow.mapSize.height = 2048
    keyLight.shadow.camera.near = 0.5
    keyLight.shadow.camera.far = 15
    keyLight.shadow.bias = -0.0005
    scene.add(keyLight)
    scene.add(keyLight.target)

    // Warm floor bounce light simulating soft reflection from the pool onto the PC
    const warmBounce = new THREE.PointLight(0xffcaa0, 2.2, 5.5, 1.2)
    warmBounce.position.set(1.92, -1.15, 0.6)
    scene.add(warmBounce)

    // Top / Rim light highlighting monitor housing contours against deep black
    const rimLight = new THREE.DirectionalLight(0xffeedd, 3.2)
    rimLight.position.set(0.6, 5.8, -4.5)
    rimLight.target.position.set(1.92, 0.2, -0.3)
    scene.add(rimLight)
    scene.add(rimLight.target)

    // Minimal cool fill light from the left
    const fillLight = new THREE.DirectionalLight(0x0a0f18, 0.18)
    fillLight.position.set(-6.0, 4.0, -3.0)
    fillLight.target.position.set(0, 0, 0)
    scene.add(fillLight)
    scene.add(fillLight.target)

    // Radiant screen phosphor glow subtly shining onto the keyboard keys
    const screenGlow = new THREE.PointLight(0x50ff9a, 1.8, 3.5, 1.5)
    screenGlow.position.set(1.95, 0.15, 0.15)
    scene.add(screenGlow)

    // 2. Realistic Ground Reflection & Light Pool Setup directly beneath the PC
    // Planar Reflector for soft glossy ground reflection with dark tint
    const reflectorGeo = new THREE.PlaneGeometry(4.8, 4.2)
    const reflectorMesh = new Reflector(reflectorGeo, {
      clipBias: 0.003,
      textureWidth: Math.min(window.innerWidth * window.devicePixelRatio, 1024),
      textureHeight: Math.min(window.innerHeight * window.devicePixelRatio, 1024),
      color: 0x222222,
    })
    reflectorMesh.rotation.x = -Math.PI / 2
    reflectorMesh.position.set(1.92, -1.395, -0.28)

    // Customize the reflector shader to apply soft radial falloff and smooth sample blur
    const origVert = reflectorMesh.material.vertexShader
    const origFrag = reflectorMesh.material.fragmentShader

    reflectorMesh.material.vertexShader = origVert
      .replace('varying vec4 vUv;', 'varying vec4 vUv;\nvarying vec2 vCoords;')
      .replace(
        'vUv = textureMatrix * vec4( position, 1.0 );',
        'vCoords = uv;\nvUv = textureMatrix * vec4( position, 1.0 );'
      )

    reflectorMesh.material.fragmentShader = origFrag
      .replace('varying vec4 vUv;', 'varying vec4 vUv;\nvarying vec2 vCoords;')
      .replace(
        'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
        `
        // Soft blurred sampling of reflected scene
        vec2 st = vUv.xy / vUv.w;
        float blur = 0.0035;
        vec4 s1 = texture2D(tDiffuse, st + vec2(-blur, -blur));
        vec4 s2 = texture2D(tDiffuse, st + vec2(blur, -blur));
        vec4 s3 = texture2D(tDiffuse, st + vec2(-blur, blur));
        vec4 s4 = texture2D(tDiffuse, st + vec2(blur, blur));
        blurred = (base * 2.0 + s1 + s2 + s3 + s4) / 6.0;

        // Feathered elliptical falloff centered beneath the PC footprint
        float dist = length((vCoords - vec2(0.5, 0.5)) * vec2(1.15, 1.0)) * 2.0;
        float alpha = smoothstep(1.0, 0.15, dist) * 0.32;

        gl_FragColor = vec4( blendOverlay( blurred.rgb, color ), alpha );
        `
      )

    reflectorMesh.material.transparent = true
    reflectorMesh.material.depthWrite = false
    scene.add(reflectorMesh)

    // Soft luminous light pool plane on the ground directly beneath PC
    const lightPoolTexture = createLightPoolTexture()
    const lightPoolGeo = new THREE.PlaneGeometry(5.2, 4.6)
    const lightPoolMat = new THREE.MeshBasicMaterial({
      map: lightPoolTexture,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const lightPoolMesh = new THREE.Mesh(lightPoolGeo, lightPoolMat)
    lightPoolMesh.rotation.x = -Math.PI / 2
    lightPoolMesh.position.set(1.92, -1.393, -0.28)
    scene.add(lightPoolMesh)

    // Contact shadow plane to anchor the computer and keyboard naturally to the floor
    const contactShadowTexture = createContactShadowTexture()
    const contactShadowGeo = new THREE.PlaneGeometry(3.6, 3.2)
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat)
    contactShadowMesh.rotation.x = -Math.PI / 2
    contactShadowMesh.position.set(1.92, -1.391, -0.28)
    scene.add(contactShadowMesh)

    // 3. Dark Volumetric Fog & Smoke System (positioned to frame the PC without occluding it)
    const smokeTexture = createSmokeParticleTexture()
    const smokeGeo = new THREE.PlaneGeometry(1, 1)
    const fogParticles = []
    const fogGroup = new THREE.Group()

    for (let i = 0; i < 36; i++) {
      const layer = i % 3
      let z, x, y, scale, color, opacity

      if (layer === 0) {
        // Deep background dark smoke: slow-moving charcoal mist far behind the PC
        z = -3.5 + Math.random() * 2.0
        x = -4.0 + Math.random() * 8.0
        y = -1.2 + Math.random() * 3.0
        scale = 4.5 + Math.random() * 3.5
        color = new THREE.Color(0x000000) // Deep pitch black smoke
        opacity = 0.16 + Math.random() * 0.08
      } else if (layer === 1) {
        // Smoke flanking the left and right sides, keeping the PC foreground completely clear
        z = -1.5 + Math.random() * 2.0
        x = Math.random() > 0.5 ? -3.8 + Math.random() * 3.2 : 3.8 + Math.random() * 2.5
        y = -1.3 + Math.random() * 2.2
        scale = 3.0 + Math.random() * 2.5
        color = new THREE.Color(0x010103)
        opacity = 0.12 + Math.random() * 0.06
      } else {
        // Low-lying floor smoke layer: rolling dark mist hugging the ground outside the PC footprint
        z = 1.0 + Math.random() * 1.5
        x = -3.5 + Math.random() * 3.2
        y = -1.38 + Math.random() * 0.2
        scale = 3.5 + Math.random() * 2.2
        color = new THREE.Color(0x010102)
        opacity = 0.14 + Math.random() * 0.06
      }

      // Using NormalBlending with dark tones creates genuine dark billowing smoke clouds without whitish glare
      const mat = new THREE.MeshBasicMaterial({
        map: smokeTexture,
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.NormalBlending,
      })

      const mesh = new THREE.Mesh(smokeGeo, mat)
      mesh.position.set(x, y, z)
      mesh.scale.set(scale, scale * (0.65 + Math.random() * 0.35), 1)
      mesh.rotation.z = Math.random() * Math.PI * 2

      fogGroup.add(mesh)
      fogParticles.push({
        mesh,
        baseX: x,
        driftSpeed: (Math.random() - 0.5) * 0.0012,
        rotSpeed: (Math.random() - 0.5) * 0.0006,
        floatSpeed: 0.0004 + Math.random() * 0.0006,
        floatOffset: Math.random() * Math.PI * 2,
        baseY: y,
      })
    }
    scene.add(fogGroup)

    // 4. Video Texture Setup for Computer Screen
    const video = document.createElement('video')
    video.src = '/uhd_30fps.mp4'
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.autoplay = true

    video.play().catch((err) => {
      console.log('Autoplay waiting for user gesture:', err)
    })

    const startPlayOnGesture = () => {
      if (video.paused) {
        video.play().catch(() => {})
      }
    }
    window.addEventListener('click', startPlayOnGesture, { once: true })
    window.addEventListener('touchstart', startPlayOnGesture, { once: true })

    const videoTexture = new THREE.VideoTexture(video)
    videoTexture.colorSpace = THREE.SRGBColorSpace
    videoTexture.minFilter = THREE.LinearFilter
    videoTexture.magFilter = THREE.LinearFilter
    videoTexture.generateMipmaps = false

    // Screen Mesh geometry & material: directly playing the video texture
    const screenGeometry = new THREE.PlaneGeometry(1, 1)
    const screenMaterial = new THREE.MeshBasicMaterial({
      map: videoTexture,
      toneMapped: false,
      side: THREE.FrontSide,
    })
    const screenMesh = new THREE.Mesh(screenGeometry, screenMaterial)
    screenMesh.scale.set(10.15, 7.875, 1)
    screenMesh.position.set(-0.2, -0.55, 0.1)
    screenMesh.rotation.x = -0.07

    const screenGroup = new THREE.Group()
    screenGroup.position.set(-22, 11, 2)
    screenGroup.rotation.y = Math.PI - 0.735
    screenGroup.add(screenMesh)

    // 5. Model Group with exact placement & scale
    const modelGroup = new THREE.Group()
    const updateGroupTransform = () => {
      const isMobile = window.innerWidth <= 1024
      modelGroup.position.set(isMobile ? -0.5 : -1.1, isMobile ? -0.9 : -1.4, 0)
      const s = isMobile ? 0.105 : 0.14
      modelGroup.scale.set(s, s, s)
      modelGroup.rotation.y = Math.PI

      // Synchronize floor reflector, light pool, and shadow with mobile/desktop layout
      const floorY = isMobile ? -0.895 : -1.395
      const pcX = isMobile ? -0.5 + 21.54 * 0.105 : -1.1 + 21.54 * 0.14
      const pcZ = isMobile ? -1.98 * 0.105 : -1.98 * 0.14
      const gScale = isMobile ? 0.75 : 1.0

      if (reflectorMesh) {
        reflectorMesh.position.set(pcX, floorY, pcZ)
        reflectorMesh.scale.set(gScale, gScale, gScale)
      }
      if (lightPoolMesh) {
        lightPoolMesh.position.set(pcX, floorY + 0.001, pcZ)
        lightPoolMesh.scale.set(gScale, gScale, gScale)
      }
      if (contactShadowMesh) {
        contactShadowMesh.position.set(pcX, floorY + 0.002, pcZ)
        contactShadowMesh.scale.set(gScale, gScale, gScale)
      }
    }
    updateGroupTransform()

    // Add screen to the model group so it follows all transformations
    modelGroup.add(screenGroup)
    scene.add(modelGroup)

    // 6. Load computer.glb with DRACOLoader
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')

    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    let isDisposed = false
    gltfLoader.load(
      '/models/computer.glb',
      (gltf) => {
        if (isDisposed) return
        const model = gltf.scene

        model.traverse((child) => {
          if (child.isMesh) {
            child.frustumCulled = false
            if (child.material) {
              child.material.side = THREE.DoubleSide

              // Background mesh: deep darkened backdrop preserving organic smoke shapes in near-black
              if (child.name === 'background') {
                child.material.color = new THREE.Color(0x151515)
                child.material.roughness = 0.98
                child.material.metalness = 0.0
                child.material.emissive = new THREE.Color(0x000000)
                child.material.emissiveIntensity = 0.0
                child.receiveShadow = true
              }

              // Computer chassis: warm vintage matte plastic with rich specular sheen (fog disabled so it never gets darkened)
              if (child.name === 'computer') {
                child.material.roughness = 0.45
                child.material.metalness = 0.05
                child.material.fog = false
                child.castShadow = true
                child.receiveShadow = true
              }

              // Keyboard: crisp keys with subtle specular bevels
              if (child.name === 'keyboard') {
                child.material.roughness = 0.38
                child.material.metalness = 0.06
                child.material.fog = false
                child.castShadow = true
                child.receiveShadow = true
              }

              // Logo badge: custom "Hackstreak 3.0"
              if (child.name === 'logo' || child.material?.name === 'commodore-logo') {
                child.material.map = hackstreakLogoTexture
                child.material.roughness = 0.25
                child.material.metalness = 0.10
                child.material.fog = false
                child.material.needsUpdate = true
              }
            }
          }
        })

        modelGroup.add(model)
      },
      undefined,
      (error) => {
        console.error('Error loading /models/computer.glb:', error)
      }
    )

    // 7. Mouse parallax tracking
    let targetMouseX = 0
    let targetMouseY = 0
    let currentMouseX = 0
    let currentMouseY = 0

    const handleMouseMove = (e) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', handleMouseMove)

    // 8. Render loop with soft volumetric fog animation
    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)

      // Smooth mouse lerp
      currentMouseX += (targetMouseX - currentMouseX) * 0.05
      currentMouseY += (targetMouseY - currentMouseY) * 0.05

      // Parallax offset modulated by parallaxWeight (0 during zoom, 1 at overview)
      const pWeight = cameraState.parallaxWeight
      const parallaxX = currentMouseX * 0.22 * pWeight
      const parallaxY = -currentMouseY * 0.14 * pWeight

      camera.position.set(
        cameraState.posX + parallaxX,
        cameraState.posY + parallaxY,
        cameraState.posZ
      )

      camera.lookAt(
        cameraState.targetX + parallaxX * 0.4 * pWeight,
        cameraState.targetY,
        cameraState.targetZ
      )

      // Subtle organic volumetric fog drifting and rotation
      const time = performance.now() * 0.001
      fogParticles.forEach((fog) => {
        fog.mesh.rotation.z += fog.rotSpeed
        fog.mesh.position.x += fog.driftSpeed
        fog.mesh.position.y =
          fog.baseY + Math.sin(time * fog.floatSpeed * 2.0 + fog.floatOffset) * 0.06
        if (fog.mesh.position.x > 5.5) fog.mesh.position.x = -5.5
        if (fog.mesh.position.x < -5.5) fog.mesh.position.x = 5.5
      })

      renderer.render(scene, camera)
    }
    animate()

    // 9. Window resize handler
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      if (reflectorMesh && reflectorMesh.getRenderTarget) {
        reflectorMesh.getRenderTarget().setSize(
          Math.min(width * window.devicePixelRatio, 1024),
          Math.min(height * window.devicePixelRatio, 1024)
        )
      }
      updateGroupTransform()
    }
    window.addEventListener('resize', handleResize)

    // 10. Cleanup
    return () => {
      isDisposed = true
      cancelAnimationFrame(animId)
      loadingTween.kill()
      if (scrollTriggerInstance) scrollTriggerInstance.kill()
      ScrollTrigger.getAll().forEach((t) => t.kill())
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('click', startPlayOnGesture)
      window.removeEventListener('touchstart', startPlayOnGesture)

      video.pause()
      video.removeAttribute('src')
      video.load()
      videoTexture.dispose()
      screenGeometry.dispose()
      screenMaterial.dispose()

      hackstreakLogoTexture.dispose()

      smokeTexture.dispose()
      smokeGeo.dispose()
      fogParticles.forEach((f) => {
        f.mesh.geometry?.dispose()
        f.mesh.material?.dispose()
      })

      reflectorMesh.dispose()
      reflectorGeo.dispose()

      lightPoolTexture.dispose()
      lightPoolGeo.dispose()
      lightPoolMat.dispose()

      contactShadowTexture.dispose()
      contactShadowGeo.dispose()
      contactShadowMat.dispose()

      dracoLoader.dispose()
      renderer.dispose()

      scene.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m?.dispose())
          } else if (child.material) {
            child.material.dispose()
          }
        }
      })
    }
  }, [])

  return (
    <div
      className="fixed inset-0 w-screen overflow-y-auto overscroll-none z-50 select-none bg-black"
      id="scroll-container"
      ref={scrollContainerRef}
      tabIndex="-1"
    >
      {/* Fullscreen Retro CRT Loading Screen Overlay - Hides PC body and screen until loading completes */}
      <div
        ref={loadingOverlayRef}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black select-none pointer-events-auto"
        style={{ width: '100vw', height: '100vh', transition: 'opacity 0.85s ease-out' }}
      >
        <canvas
          ref={loadingCanvasRef}
          width={1024}
          height={530}
          className="max-w-full max-h-full object-contain"
          style={{
            aspectRatio: '1024 / 530',
            boxShadow: '0 0 80px rgba(27, 22, 130, 0.3)',
          }}
        />
      </div>

      {/* Fullscreen Three.js WebGL Canvas Layer */}
      <div className="fixed inset-0 w-screen pointer-events-none z-40">
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '100%', height: '100%' }}>
            <canvas
              ref={canvasRef}
              style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'auto' }}
              data-engine="three.js r186"
            />
          </div>
        </div>
      </div>

      {/* Scroll track allowing ScrollTrigger to scrub smoothly */}
      <div style={{ height: '240vh', width: '100%', pointerEvents: 'none' }}></div>
    </div>
  )
}
