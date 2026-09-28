// Moulin V32 — feuillages vivants.
//
// Les couronnes gardent leur géométrie (1 200 arbres, déjà près d'un million de
// triangles), mais leur matière change :
//  - un relief de bouquets de feuilles dessiné dans le shader, sans texture ;
//  - la lumière qui traverse les feuilles quand on regarde vers le soleil ;
//  - un liseré de ciel sur les bords et un léger reflet quand une rafale retourne
//    les feuilles (même front de rafale que le balancement des arbres).
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  const VERTEX_PARS = "varying vec3 vFoliageWorld32;\nvarying vec3 vFoliageNormal32;\n";
  const VERTEX_MAIN = `#include <project_vertex>
  vec4 foliageWorld32=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
   foliageWorld32=instanceMatrix*foliageWorld32;
  #endif
  foliageWorld32=modelMatrix*foliageWorld32;
  vFoliageWorld32=foliageWorld32.xyz;
  vFoliageNormal32=normalize(inverseTransformDirection(transformedNormal,viewMatrix));`;

  const FRAGMENT_PARS = `varying vec3 vFoliageWorld32;
varying vec3 vFoliageNormal32;
uniform vec3 sunDirection32,sunColor32;
uniform float daylight32,golden32;
uniform float uMoulinTime20,uMoulinWind20;
uniform vec2 uMoulinDirection20;
float foliageClumps32(vec3 p){
  vec3 q=p*1.85;
  float a=sin(q.x*1.7+sin(q.y*2.3+q.z*1.1))*sin(q.z*1.9+sin(q.x*1.3-q.y*.7))*sin(q.y*2.1+q.x*.4);
  float b=sin(q.x*4.7+q.z*3.1+q.y*.8)*sin(q.y*5.3-q.x*2.2)*sin(q.z*4.9+q.y*1.7);
  return .5+.34*a+.16*b;
}
`;

  const FRAGMENT_ALBEDO = `#include <color_fragment>
  float leaves32=foliageClumps32(vFoliageWorld32);
  diffuseColor.rgb*=.8+.36*leaves32;
  diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.1,1.07,.8),smoothstep(.58,.92,leaves32)*.55);`;

  const FRAGMENT_LIGHT = `vec3 foliageN32=normalize(vFoliageNormal32);
  vec3 foliageV32=normalize(cameraPosition-vFoliageWorld32);
  vec3 foliageL32=normalize(sunDirection32);
  float foliageBack32=pow(max(dot(foliageV32,-foliageL32),0.),3.5);
  float foliageThin32=1.-max(dot(foliageN32,foliageL32),0.);
  outgoingLight+=diffuseColor.rgb*sunColor32*vec3(1.05,1.16,.62)*foliageBack32*(.35+.65*foliageThin32)*(.5+.4*leaves32)*.75*daylight32;
  float foliageRim32=pow(1.-max(dot(foliageN32,foliageV32),0.),3.)*(.3+.7*max(foliageN32.y,0.));
  outgoingLight+=diffuseColor.rgb*mix(vec3(.30,.42,.56),vec3(.62,.44,.30),golden32)*foliageRim32*.42*daylight32;
  vec2 foliageDir32=normalize(uMoulinDirection20+vec2(.00001));
  float foliageAlong32=dot(vFoliageWorld32.xz,foliageDir32);
  float foliageForce32=pow(clamp(uMoulinWind20,0.,1.8),1.05);
  float foliageFront32=sin(foliageAlong32*.042-uMoulinTime20*(.62+foliageForce32*.55)+sin(foliageAlong32*.011+uMoulinTime20*.07)*2.2);
  outgoingLight*=1.+smoothstep(.35,1.,foliageFront32)*foliageForce32*.1*(.4+.6*leaves32);
  gl_FragColor = vec4( outgoingLight, diffuseColor.a );`;

  function patchCanopy(material) {
    return V32.patchMaterial(material, "foliage", (shader) => {
      const U = V32.uniforms;
      shader.uniforms.sunDirection32 = U.sunDirection;
      shader.uniforms.sunColor32 = U.sunColor;
      shader.uniforms.daylight32 = U.daylight;
      shader.uniforms.golden32 = U.golden;
      // Les uniformes du vent sont ajoutés par MoulinWind20 ; on les garantit ici.
      shader.uniforms.uMoulinTime20 = shader.uniforms.uMoulinTime20 || U.time;
      shader.uniforms.uMoulinWind20 = shader.uniforms.uMoulinWind20 || U.wind;
      shader.uniforms.uMoulinDirection20 = shader.uniforms.uMoulinDirection20 || U.windDirection;
      shader.vertexShader = VERTEX_PARS + shader.vertexShader.replace("#include <project_vertex>", VERTEX_MAIN);
      shader.fragmentShader = FRAGMENT_PARS + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", FRAGMENT_ALBEDO);
      shader.fragmentShader = shader.fragmentShader.replace(
        "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
        FRAGMENT_LIGHT,
      );
    });
  }

  V32.register(
    "foliage",
    function (context) {
      const { game } = context;
      const canopy = game.forest?.materials?.[2];
      if (canopy) patchCanopy(canopy);
      return {
        update(dt, time) {
          V32.uniforms.time.value = time;
          const wind = game.ambience?.wind?.value;
          if (Number.isFinite(wind)) V32.uniforms.wind.value = wind;
          const direction = game.ambience?.windDirection?.value;
          if (direction) V32.uniforms.windDirection.value.copy(direction);
          return false;
        },
      };
    },
    20,
  );
})();
