(function(){class s extends THREE.Mesh{constructor(h,n={}){super(h),this.type="Reflector";const c=this,H=n.color!==void 0?new THREE.Color(n.color):new THREE.Color(8355711),T=n.textureWidth||512,g=n.textureHeight||512,y=n.clipBias||0,b=n.shader||s.ReflectorShader,i=new THREE.Plane,a=new THREE.Vector3,l=new THREE.Vector3,M=new THREE.Vector3,u=new THREE.Matrix4,p=new THREE.Vector3(0,0,-1),o=new THREE.Vector4,d=new THREE.Vector3,v=new THREE.Vector3,f=new THREE.Vector4,x=new THREE.Matrix4,t=new THREE.PerspectiveCamera,P={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBFormat},m=new THREE.WebGLRenderTarget(T,g,P);(!THREE.MathUtils.isPowerOfTwo(T)||!THREE.MathUtils.isPowerOfTwo(g))&&(m.texture.generateMipmaps=!1);const R=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.clone(b.uniforms),fragmentShader:b.fragmentShader,vertexShader:b.vertexShader});R.uniforms.tDiffuse.value=m.texture,R.uniforms.color.value=H,R.uniforms.textureMatrix.value=x,this.material=R,this.onBeforeRender=function(e,W,E){if(l.setFromMatrixPosition(c.matrixWorld),M.setFromMatrixPosition(E.matrixWorld),u.extractRotation(c.matrixWorld),a.set(0,0,1),a.applyMatrix4(u),d.subVectors(l,M),d.dot(a)>0)return;d.reflect(a).negate(),d.add(l),u.extractRotation(E.matrixWorld),p.set(0,0,-1),p.applyMatrix4(u),p.add(M),v.subVectors(l,p),v.reflect(a).negate(),v.add(l),t.position.copy(d),t.up.set(0,1,0),t.up.applyMatrix4(u),t.up.reflect(a),t.lookAt(v),t.far=E.far,t.updateMatrixWorld(),t.projectionMatrix.copy(E.projectionMatrix),x.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),x.multiply(t.projectionMatrix),x.multiply(t.matrixWorldInverse),x.multiply(c.matrixWorld),i.setFromNormalAndCoplanarPoint(a,l),i.applyMatrix4(t.matrixWorldInverse),o.set(i.normal.x,i.normal.y,i.normal.z,i.constant);const r=t.projectionMatrix;f.x=(Math.sign(o.x)+r.elements[8])/r.elements[0],f.y=(Math.sign(o.y)+r.elements[9])/r.elements[5],f.z=-1,f.w=(1+r.elements[10])/r.elements[14],o.multiplyScalar(2/o.dot(f)),r.elements[2]=o.x,r.elements[6]=o.y,r.elements[10]=o.z+1-y,r.elements[14]=o.w,m.texture.encoding=e.outputEncoding,c.visible=!1;const F=e.getRenderTarget(),U=e.xr.enabled,S=e.shadowMap.autoUpdate;e.xr.enabled=!1,e.shadowMap.autoUpdate=!1,e.setRenderTarget(m),e.state.buffers.depth.setMask(!0),e.autoClear===!1&&e.clear(),e.render(W,t),e.xr.enabled=U,e.shadowMap.autoUpdate=S,e.setRenderTarget(F);const w=E.viewport;w!==void 0&&e.state.viewport(w),c.visible=!0},this.getRenderTarget=function(){return m}}}s.prototype.isReflector=!0,s.ReflectorShader={uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null}},vertexShader:`
		uniform mat4 textureMatrix;
		varying vec4 vUv;

		void main() {

			vUv = textureMatrix * vec4( position, 1.0 );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`
		uniform vec3 color;
		uniform sampler2D tDiffuse;
		varying vec4 vUv;

		float blendOverlay( float base, float blend ) {

			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );

		}

		vec3 blendOverlay( vec3 base, vec3 blend ) {

			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );

		}

		void main() {

			vec4 base = texture2DProj( tDiffuse, vUv );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

		}`},THREE.Reflector=s})();
