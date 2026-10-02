"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[6174],{3105:(t,e,i)=>{i.d(e,{x:()=>h});var s=i(2111),r=i(1521),n=i(66033),o=i(20933);let a=parseInt(n.sPf.replace(/\D+/g,"")),l=function(t,e,i,s){var r;return(r=class extends n.BKk{constructor(s){for(let r in super({vertexShader:e,fragmentShader:i,...s}),t)this.uniforms[r]=new n.nc$(t[r]),Object.defineProperty(this,r,{get(){return this.uniforms[r].value},set(t){this.uniforms[r].value=t}});this.uniforms=n.LlO.clone(this.uniforms)}}).key=n.cj9.generateUUID(),r}({cellSize:.5,sectionSize:1,fadeDistance:100,fadeStrength:1,fadeFrom:1,cellThickness:.5,sectionThickness:1,cellColor:new n.Q1f,sectionColor:new n.Q1f,infiniteGrid:!1,followCamera:!1,worldCamProjPosition:new n.Pq0,worldPlanePosition:new n.Pq0},`
    varying vec3 localPosition;
    varying vec4 worldPosition;

    uniform vec3 worldCamProjPosition;
    uniform vec3 worldPlanePosition;
    uniform float fadeDistance;
    uniform bool infiniteGrid;
    uniform bool followCamera;

    void main() {
      localPosition = position.xzy;
      if (infiniteGrid) localPosition *= 1.0 + fadeDistance;
      
      worldPosition = modelMatrix * vec4(localPosition, 1.0);
      if (followCamera) {
        worldPosition.xyz += (worldCamProjPosition - worldPlanePosition);
        localPosition = (inverse(modelMatrix) * worldPosition).xyz;
      }

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,`
    varying vec3 localPosition;
    varying vec4 worldPosition;

    uniform vec3 worldCamProjPosition;
    uniform float cellSize;
    uniform float sectionSize;
    uniform vec3 cellColor;
    uniform vec3 sectionColor;
    uniform float fadeDistance;
    uniform float fadeStrength;
    uniform float fadeFrom;
    uniform float cellThickness;
    uniform float sectionThickness;

    float getGrid(float size, float thickness) {
      vec2 r = localPosition.xz / size;
      vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
      float line = min(grid.x, grid.y) + 1.0 - thickness;
      return 1.0 - min(line, 1.0);
    }

    void main() {
      float g1 = getGrid(cellSize, cellThickness);
      float g2 = getGrid(sectionSize, sectionThickness);

      vec3 from = worldCamProjPosition*vec3(fadeFrom);
      float dist = distance(from, worldPosition.xyz);
      float d = 1.0 - min(dist / fadeDistance, 1.0);
      vec3 color = mix(cellColor, sectionColor, min(1.0, sectionThickness * g2));

      gl_FragColor = vec4(color, (g1 + g2) * pow(d, fadeStrength));
      gl_FragColor.a = mix(0.75 * gl_FragColor.a, gl_FragColor.a, g2);
      if (gl_FragColor.a <= 0.0) discard;

      #include <tonemapping_fragment>
      #include <${a>=154?"colorspace_fragment":"encodings_fragment"}>
    }
  `),h=r.forwardRef(({args:t,cellColor:e="#000000",sectionColor:i="#2080ff",cellSize:a=.5,sectionSize:h=1,followCamera:c=!1,infiniteGrid:d=!1,fadeDistance:u=100,fadeStrength:m=1,fadeFrom:_=1,cellThickness:p=.5,sectionThickness:f=1,side:g=n.hsX,...v},y)=>{(0,o.e)({GridMaterial:l});let E=r.useRef(null);r.useImperativeHandle(y,()=>E.current,[]);let O=new n.Zcv,T=new n.Pq0(0,1,0),x=new n.Pq0(0,0,0);return(0,o.F)(t=>{O.setFromNormalAndCoplanarPoint(T,x).applyMatrix4(E.current.matrixWorld);let e=E.current.material,i=e.uniforms.worldCamProjPosition,s=e.uniforms.worldPlanePosition;O.projectPoint(t.camera.position,i.value),s.value.set(0,0,0).applyMatrix4(E.current.matrixWorld)}),r.createElement("mesh",(0,s.A)({ref:E,frustumCulled:!1},v),r.createElement("gridMaterial",(0,s.A)({transparent:!0,"extensions-derivatives":!0,side:g},{cellSize:a,sectionSize:h,cellColor:e,sectionColor:i,cellThickness:p,sectionThickness:f},{fadeDistance:u,fadeStrength:m,fadeFrom:_,infiniteGrid:d,followCamera:c})),r.createElement("planeGeometry",{args:t}))})},4052:(t,e,i)=>{let s,r;i.d(e,{E:()=>y});var n=i(2111),o=i(1521),a=i(51023),l=i(66033),h=i(20933);let c=new l.Pq0,d=new l.Pq0,u=new l.Pq0,m=new l.I9Y;function _(t,e,i){let s=c.setFromMatrixPosition(t.matrixWorld);s.project(e);let r=i.width/2,n=i.height/2;return[s.x*r+r,-(s.y*n)+n]}let p=t=>1e-10>Math.abs(t)?0:t;function f(t,e,i=""){let s="matrix3d(";for(let i=0;16!==i;i++)s+=p(e[i]*t.elements[i])+(15!==i?",":")");return i+s}let g=(s=[1,-1,1,1,1,-1,1,1,1,-1,1,1,1,-1,1,1],t=>f(t,s)),v=(r=t=>[1/t,1/t,1/t,1,-1/t,-1/t,-1/t,-1,1/t,1/t,1/t,1,1,1,1,1],(t,e)=>f(t,r(e),"translate(-50%,-50%)")),y=o.forwardRef(({children:t,eps:e=.001,style:i,className:s,prepend:r,center:f,fullscreen:y,portal:E,distanceFactor:O,sprite:T=!1,transform:x=!1,occlude:C,onOcclude:U,castShadow:w,receiveShadow:S,material:b,geometry:A,zIndexRange:L=[0x1000037,0],calculatePosition:P=_,as:D="div",wrapperClass:z,pointerEvents:M="auto",...R},H)=>{let{gl:F,camera:N,scene:k,size:I,raycaster:B,events:V,viewport:Y}=(0,h.D)(),[Z]=o.useState(()=>document.createElement(D)),j=o.useRef(null),G=o.useRef(null),W=o.useRef(0),q=o.useRef([0,0]),K=o.useRef(null),Q=o.useRef(null),X=(null==E?void 0:E.current)||V.connected||F.domElement.parentNode,$=o.useRef(null),J=o.useRef(!1),tt=o.useMemo(()=>C&&"blending"!==C||Array.isArray(C)&&C.length&&function(t){return t&&"object"==typeof t&&"current"in t}(C[0]),[C]);o.useLayoutEffect(()=>{let t=F.domElement;C&&"blending"===C?(t.style.zIndex=`${Math.floor(L[0]/2)}`,t.style.position="absolute",t.style.pointerEvents="none"):(t.style.zIndex=null,t.style.position=null,t.style.pointerEvents=null)},[C]),o.useLayoutEffect(()=>{if(G.current){let t=j.current=a.createRoot(Z);if(k.updateMatrixWorld(),x)Z.style.cssText="position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;";else{let t=P(G.current,N,I);Z.style.cssText=`position:absolute;top:0;left:0;transform:translate3d(${t[0]}px,${t[1]}px,0);transform-origin:0 0;`}return X&&(r?X.prepend(Z):X.appendChild(Z)),()=>{X&&X.removeChild(Z),t.unmount()}}},[X,x]),o.useLayoutEffect(()=>{z&&(Z.className=z)},[z]);let te=o.useMemo(()=>x?{position:"absolute",top:0,left:0,width:I.width,height:I.height,transformStyle:"preserve-3d",pointerEvents:"none"}:{position:"absolute",transform:f?"translate3d(-50%,-50%,0)":"none",...y&&{top:-I.height/2,left:-I.width/2,width:I.width,height:I.height},...i},[i,f,y,I,x]),ti=o.useMemo(()=>({position:"absolute",pointerEvents:M}),[M]);o.useLayoutEffect(()=>{var e,r;J.current=!1,x?null==(e=j.current)||e.render(o.createElement("div",{ref:K,style:te},o.createElement("div",{ref:Q,style:ti},o.createElement("div",{ref:H,className:s,style:i,children:t})))):null==(r=j.current)||r.render(o.createElement("div",{ref:H,style:te,className:s,children:t}))});let ts=o.useRef(!0);(0,h.F)(t=>{if(G.current){N.updateMatrixWorld(),G.current.updateWorldMatrix(!0,!1);let t=x?q.current:P(G.current,N,I);if(x||Math.abs(W.current-N.zoom)>e||Math.abs(q.current[0]-t[0])>e||Math.abs(q.current[1]-t[1])>e){let e=function(t,e){let i=c.setFromMatrixPosition(t.matrixWorld),s=d.setFromMatrixPosition(e.matrixWorld),r=i.sub(s),n=e.getWorldDirection(u);return r.angleTo(n)>Math.PI/2}(G.current,N),i=!1;tt&&(Array.isArray(C)?i=C.map(t=>t.current):"blending"!==C&&(i=[k]));let s=ts.current;i?ts.current=function(t,e,i,s){let r=c.setFromMatrixPosition(t.matrixWorld),n=r.clone();n.project(e),m.set(n.x,n.y),i.setFromCamera(m,e);let o=i.intersectObjects(s,!0);if(o.length){let t=o[0].distance;return r.distanceTo(i.ray.origin)<t}return!0}(G.current,N,B,i)&&!e:ts.current=!e,s!==ts.current&&(U?U(!ts.current):Z.style.display=ts.current?"block":"none");let r=Math.floor(L[0]/2),n=C?tt?[L[0],r]:[r-1,0]:L;if(Z.style.zIndex=`${function(t,e,i){if(e instanceof l.ubm||e instanceof l.qUd){let s=c.setFromMatrixPosition(t.matrixWorld),r=d.setFromMatrixPosition(e.matrixWorld),n=s.distanceTo(r),o=(i[1]-i[0])/(e.far-e.near),a=i[1]-o*e.far;return Math.round(o*n+a)}}(G.current,N,n)}`,x){let[t,e]=[I.width/2,I.height/2],i=N.projectionMatrix.elements[5]*e,{isOrthographicCamera:s,top:r,left:n,bottom:o,right:a}=N,l=g(N.matrixWorldInverse),h=s?`scale(${i})translate(${p(-(a+n)/2)}px,${p((r+o)/2)}px)`:`translateZ(${i}px)`,c=G.current.matrixWorld;T&&((c=N.matrixWorldInverse.clone().transpose().copyPosition(c).scale(G.current.scale)).elements[3]=c.elements[7]=c.elements[11]=0,c.elements[15]=1),Z.style.width=I.width+"px",Z.style.height=I.height+"px",Z.style.perspective=s?"":`${i}px`,K.current&&Q.current&&(K.current.style.transform=`${h}${l}translate(${t}px,${e}px)`,Q.current.style.transform=v(c,1/((O||10)/400)))}else{let e=void 0===O?1:function(t,e){if(e instanceof l.qUd)return e.zoom;if(!(e instanceof l.ubm))return 1;{let i=c.setFromMatrixPosition(t.matrixWorld),s=d.setFromMatrixPosition(e.matrixWorld);return 1/(2*Math.tan(e.fov*Math.PI/180/2)*i.distanceTo(s))}}(G.current,N)*O;Z.style.transform=`translate3d(${t[0]}px,${t[1]}px,0) scale(${e})`}q.current=t,W.current=N.zoom}}if(!tt&&$.current&&!J.current)if(x){if(K.current){let t=K.current.children[0];if(null!=t&&t.clientWidth&&null!=t&&t.clientHeight){let{isOrthographicCamera:e}=N;if(e||A)R.scale&&(Array.isArray(R.scale)?R.scale instanceof l.Pq0?$.current.scale.copy(R.scale.clone().divideScalar(1)):$.current.scale.set(1/R.scale[0],1/R.scale[1],1/R.scale[2]):$.current.scale.setScalar(1/R.scale));else{let e=(O||10)/400,i=t.clientWidth*e,s=t.clientHeight*e;$.current.scale.set(i,s,1)}J.current=!0}}}else{let e=Z.children[0];if(null!=e&&e.clientWidth&&null!=e&&e.clientHeight){let t=1/Y.factor,i=e.clientWidth*t,s=e.clientHeight*t;$.current.scale.set(i,s,1),J.current=!0}$.current.lookAt(t.camera.position)}});let tr=o.useMemo(()=>({vertexShader:x?void 0:`
          /*
            This shader is from the THREE's SpriteMaterial.
            We need to turn the backing plane into a Sprite
            (make it always face the camera) if "transfrom"
            is false.
          */
          #include <common>

          void main() {
            vec2 center = vec2(0., 1.);
            float rotation = 0.0;

            // This is somewhat arbitrary, but it seems to work well
            // Need to figure out how to derive this dynamically if it even matters
            float size = 0.03;

            vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
            vec2 scale;
            scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
            scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );

            bool isPerspective = isPerspectiveMatrix( projectionMatrix );
            if ( isPerspective ) scale *= - mvPosition.z;

            vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale * size;
            vec2 rotatedPosition;
            rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
            rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
            mvPosition.xy += rotatedPosition;

            gl_Position = projectionMatrix * mvPosition;
          }
      `,fragmentShader:`
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      `}),[x]);return o.createElement("group",(0,n.A)({},R,{ref:G}),C&&!tt&&o.createElement("mesh",{castShadow:w,receiveShadow:S,ref:$},A||o.createElement("planeGeometry",null),b||o.createElement("shaderMaterial",{side:l.$EB,vertexShader:tr.vertexShader,fragmentShader:tr.fragmentShader})))})},44588:(t,e,i)=>{i.d(e,{_:()=>h});var s=i(2111),r=i(1521),n=i(66033),o=i(20933);let a={uniforms:{tDiffuse:{value:null},h:{value:1/512}},vertexShader:`
      varying vec2 vUv;

      void main() {

        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

      }
  `,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform float h;

    varying vec2 vUv;

    void main() {

    	vec4 sum = vec4( 0.0 );

    	sum += texture2D( tDiffuse, vec2( vUv.x - 4.0 * h, vUv.y ) ) * 0.051;
    	sum += texture2D( tDiffuse, vec2( vUv.x - 3.0 * h, vUv.y ) ) * 0.0918;
    	sum += texture2D( tDiffuse, vec2( vUv.x - 2.0 * h, vUv.y ) ) * 0.12245;
    	sum += texture2D( tDiffuse, vec2( vUv.x - 1.0 * h, vUv.y ) ) * 0.1531;
    	sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 1.0 * h, vUv.y ) ) * 0.1531;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 2.0 * h, vUv.y ) ) * 0.12245;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 3.0 * h, vUv.y ) ) * 0.0918;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 4.0 * h, vUv.y ) ) * 0.051;

    	gl_FragColor = sum;

    }
  `},l={uniforms:{tDiffuse:{value:null},v:{value:1/512}},vertexShader:`
    varying vec2 vUv;

    void main() {

      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    }
  `,fragmentShader:`

  uniform sampler2D tDiffuse;
  uniform float v;

  varying vec2 vUv;

  void main() {

    vec4 sum = vec4( 0.0 );

    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 4.0 * v ) ) * 0.051;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 3.0 * v ) ) * 0.0918;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 2.0 * v ) ) * 0.12245;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 1.0 * v ) ) * 0.1531;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 1.0 * v ) ) * 0.1531;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 2.0 * v ) ) * 0.12245;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 3.0 * v ) ) * 0.0918;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 4.0 * v ) ) * 0.051;

    gl_FragColor = sum;

  }
  `},h=r.forwardRef(({scale:t=10,frames:e=1/0,opacity:i=1,width:h=1,height:c=1,blur:d=1,near:u=0,far:m=10,resolution:_=512,smooth:p=!0,color:f="#000000",depthWrite:g=!1,renderOrder:v,...y},E)=>{let O,T,x=r.useRef(null),C=(0,o.D)(t=>t.scene),U=(0,o.D)(t=>t.gl),w=r.useRef(null);h*=Array.isArray(t)?t[0]:t||1,c*=Array.isArray(t)?t[1]:t||1;let[S,b,A,L,P,D,z]=r.useMemo(()=>{let t=new n.nWS(_,_),e=new n.nWS(_,_);e.texture.generateMipmaps=t.texture.generateMipmaps=!1;let i=new n.bdM(h,c).rotateX(Math.PI/2),s=new n.eaF(i),r=new n.CSG;r.depthTest=r.depthWrite=!1,r.onBeforeCompile=t=>{t.uniforms={...t.uniforms,ucolor:{value:new n.Q1f(f)}},t.fragmentShader=t.fragmentShader.replace("void main() {",`uniform vec3 ucolor;
           void main() {
          `),t.fragmentShader=t.fragmentShader.replace("vec4( vec3( 1.0 - fragCoordZ ), opacity );","vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );")};let o=new n.BKk(a),d=new n.BKk(l);return d.depthTest=o.depthTest=!1,[t,i,r,s,o,d,e]},[_,h,c,t,f]),M=t=>{L.visible=!0,L.material=P,P.uniforms.tDiffuse.value=S.texture,P.uniforms.h.value=t/256,U.setRenderTarget(z),U.render(L,w.current),L.material=D,D.uniforms.tDiffuse.value=z.texture,D.uniforms.v.value=t/256,U.setRenderTarget(S),U.render(L,w.current),L.visible=!1},R=0;return(0,o.F)(()=>{w.current&&(e===1/0||R<e)&&(R++,O=C.background,T=C.overrideMaterial,x.current.visible=!1,C.background=null,C.overrideMaterial=A,U.setRenderTarget(S),U.render(C,w.current),M(d),p&&M(.4*d),U.setRenderTarget(null),x.current.visible=!0,C.overrideMaterial=T,C.background=O)}),r.useImperativeHandle(E,()=>x.current,[]),r.createElement("group",(0,s.A)({"rotation-x":Math.PI/2},y,{ref:x}),r.createElement("mesh",{renderOrder:v,geometry:b,scale:[1,-1,1],rotation:[-Math.PI/2,0,0]},r.createElement("meshBasicMaterial",{transparent:!0,map:S.texture,opacity:i,depthWrite:g})),r.createElement("orthographicCamera",{ref:w,args:[-h/2,h/2,c/2,-c/2,u,m]}))})},60645:(t,e,i)=>{i.d(e,{pP:()=>r});var s=i(66033);function r(t,e=!1){let i=null!==t[0].index,o=new Set(Object.keys(t[0].attributes)),a=new Set(Object.keys(t[0].morphAttributes)),l={},h={},c=t[0].morphTargetsRelative,d=new s.LoY,u=0;for(let s=0;s<t.length;++s){let r=t[s],n=0;if(i!==(null!==r.index))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+s+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let t in r.attributes){if(!o.has(t))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+s+'. All geometries must have compatible attributes; make sure "'+t+'" attribute exists among all geometries, or in none of them.'),null;void 0===l[t]&&(l[t]=[]),l[t].push(r.attributes[t]),n++}if(n!==o.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+s+". Make sure all geometries have the same number of attributes."),null;if(c!==r.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+s+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let t in r.morphAttributes){if(!a.has(t))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+s+".  .morphAttributes must be consistent throughout all geometries."),null;void 0===h[t]&&(h[t]=[]),h[t].push(r.morphAttributes[t])}if(e){let t;if(i)t=r.index.count;else{if(void 0===r.attributes.position)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+s+". The geometry must have either an index or a position attribute"),null;t=r.attributes.position.count}d.addGroup(u,t,s),u+=t}}if(i){let e=0,i=[];for(let s=0;s<t.length;++s){let r=t[s].index;for(let t=0;t<r.count;++t)i.push(r.getX(t)+e);e+=t[s].attributes.position.count}d.setIndex(i)}for(let t in l){let e=n(l[t]);if(!e)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+t+" attribute."),null;d.setAttribute(t,e)}for(let t in h){let e=h[t][0].length;if(0!==e){d.morphAttributes=d.morphAttributes||{},d.morphAttributes[t]=[];for(let i=0;i<e;++i){let e=[];for(let s=0;s<h[t].length;++s)e.push(h[t][s][i]);let s=n(e);if(!s)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+t+" morphAttribute."),null;d.morphAttributes[t].push(s)}}}return d}function n(t){let e,i,r,n=-1,o=0;for(let s=0;s<t.length;++s){let a=t[s];if(void 0===e&&(e=a.array.constructor),e!==a.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(void 0===i&&(i=a.itemSize),i!==a.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(void 0===r&&(r=a.normalized),r!==a.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(-1===n&&(n=a.gpuType),n!==a.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;o+=a.count*i}let a=new e(o),l=new s.THS(a,i,r),h=0;for(let e=0;e<t.length;++e){let s=t[e];if(s.isInterleavedBufferAttribute){let t=h/i;for(let e=0,r=s.count;e<r;e++)for(let r=0;r<i;r++){let i=s.getComponent(e,r);l.setComponent(e+t,r,i)}}else a.set(s.array,h);h+=s.count*i}return void 0!==n&&(l.gpuType=n),l}},62807:(t,e,i)=>{let s,r,n,o,a,l,h,c,d,u,m,_,p,f,g,v,y,E,O,T,x,C,U;i.d(e,{a:()=>$});var w=i(2111),S=i(66033),b=i(1521),A=i(20933);let L={LEFT:1,RIGHT:2,MIDDLE:4},P=Object.freeze({NONE:0,ROTATE:1,TRUCK:2,SCREEN_PAN:4,OFFSET:8,DOLLY:16,ZOOM:32,TOUCH_ROTATE:64,TOUCH_TRUCK:128,TOUCH_SCREEN_PAN:256,TOUCH_OFFSET:512,TOUCH_DOLLY:1024,TOUCH_ZOOM:2048,TOUCH_DOLLY_TRUCK:4096,TOUCH_DOLLY_SCREEN_PAN:8192,TOUCH_DOLLY_OFFSET:16384,TOUCH_DOLLY_ROTATE:32768,TOUCH_ZOOM_TRUCK:65536,TOUCH_ZOOM_OFFSET:131072,TOUCH_ZOOM_SCREEN_PAN:262144,TOUCH_ZOOM_ROTATE:524288}),D={NONE:0,IN:1,OUT:-1};function z(t){return t.isPerspectiveCamera}function M(t){return t.isOrthographicCamera}let R=2*Math.PI,H=Math.PI/2,F=Math.PI/180;function N(t,e,i){return Math.max(e,Math.min(i,t))}function k(t,e=1e-5){return Math.abs(t)<e}function I(t,e,i=1e-5){return k(t-e,i)}function B(t,e){return Math.round(t/e)*e}function V(t){return isFinite(t)?t:t<0?-Number.MAX_VALUE:Number.MAX_VALUE}function Y(t){return Math.abs(t)<Number.MAX_VALUE?t:1/0*t}function Z(t,e,i,s,r=1/0,n){let o=2/(s=Math.max(1e-4,s)),a=o*n,l=1/(1+a+.48*a*a+.235*a*a*a),h=t-e,c=e,d=r*s;e=t-(h=N(h,-d,d));let u=(i.value+o*h)*n;i.value=(i.value-o*u)*l;let m=e+(h+u)*l;return c-t>0==m>c&&(i.value=((m=c)-c)/n),m}function j(t,e,i,s,r=1/0,n,o){let a=2/(s=Math.max(1e-4,s)),l=a*n,h=1/(1+l+.48*l*l+.235*l*l*l),c=e.x,d=e.y,u=e.z,m=t.x-c,_=t.y-d,p=t.z-u,f=c,g=d,v=u,y=r*s,E=m*m+_*_+p*p;if(E>y*y){let t=Math.sqrt(E);m=m/t*y,_=_/t*y,p=p/t*y}c=t.x-m,d=t.y-_,u=t.z-p;let O=(i.x+a*m)*n,T=(i.y+a*_)*n,x=(i.z+a*p)*n;i.x=(i.x-a*O)*h,i.y=(i.y-a*T)*h,i.z=(i.z-a*x)*h,o.x=c+(m+O)*h,o.y=d+(_+T)*h,o.z=u+(p+x)*h;let C=f-t.x,U=g-t.y,w=v-t.z,S=o.x-f;return C*S+U*(o.y-g)+w*(o.z-v)>0&&(o.x=f,o.y=g,o.z=v,i.x=(o.x-f)/n,i.y=(o.y-g)/n,i.z=(o.z-v)/n),o}function G(t,e){e.set(0,0),t.forEach(t=>{e.x+=t.clientX,e.y+=t.clientY}),e.x/=t.length,e.y/=t.length}function W(t,e){return!!M(t)&&(console.warn(`${e} is not supported in OrthographicCamera`),!0)}class q{_listeners={};addEventListener(t,e){let i=this._listeners;void 0===i[t]&&(i[t]=[]),-1===i[t].indexOf(e)&&i[t].push(e)}hasEventListener(t,e){let i=this._listeners;return void 0!==i[t]&&-1!==i[t].indexOf(e)}removeEventListener(t,e){let i=this._listeners[t];if(void 0!==i){let t=i.indexOf(e);-1!==t&&i.splice(t,1)}}removeAllEventListeners(t){if(!t){this._listeners={};return}Array.isArray(this._listeners[t])&&(this._listeners[t].length=0)}dispatchEvent(t){let e=this._listeners[t.type];if(void 0!==e){t.target=this;let i=e.slice(0);for(let e=0,s=i.length;e<s;e++)i[e].call(this,t)}}}let K=1/8,Q=/Mac/.test(globalThis?.navigator?.platform);class X extends q{static install(t){r=Object.freeze(new(s=t.THREE).Vector3(0,0,0)),n=Object.freeze(new s.Vector3(0,1,0)),o=Object.freeze(new s.Vector3(0,0,1)),a=new s.Vector2,l=new s.Vector3,h=new s.Vector3,c=new s.Vector3,d=new s.Vector3,u=new s.Vector3,m=new s.Vector3,_=new s.Vector3,p=new s.Vector3,f=new s.Vector3,g=new s.Spherical,v=new s.Spherical,y=new s.Box3,E=new s.Box3,O=new s.Sphere,T=new s.Quaternion,x=new s.Quaternion,C=new s.Matrix4,U=new s.Raycaster}static get ACTION(){return P}minPolarAngle=0;maxPolarAngle=Math.PI;minAzimuthAngle=-1/0;maxAzimuthAngle=1/0;minDistance=Number.EPSILON;maxDistance=1/0;infinityDolly=!1;minZoom=.01;maxZoom=1/0;smoothTime=.25;draggingSmoothTime=.125;maxSpeed=1/0;azimuthRotateSpeed=1;polarRotateSpeed=1;dollySpeed=1;dollyDragInverted=!1;truckSpeed=2;dollyToCursor=!1;dragToOffset=!1;boundaryFriction=0;restThreshold=.01;colliderMeshes=[];mouseButtons;touches;cancel=()=>{};lockPointer;unlockPointer;_enabled=!0;_camera;_yAxisUpSpace;_yAxisUpSpaceInverse;_state=P.NONE;_domElement;_viewport=null;_target;_targetEnd;_focalOffset;_focalOffsetEnd;_spherical;_sphericalEnd;_lastDistance;_zoom;_zoomEnd;_lastZoom;_cameraUp0;_target0;_position0;_zoom0;_focalOffset0;_dollyControlCoord;_changedDolly=0;_changedZoom=0;_nearPlaneCorners;_hasRested=!0;_boundary;_boundaryEnclosesCamera=!1;_needsUpdate=!0;_updatedLastTime=!1;_elementRect=new DOMRect;_isDragging=!1;_dragNeedsUpdate=!0;_activePointers=[];_lockedPointer=null;_interactiveArea=new DOMRect(0,0,1,1);_isUserControllingRotate=!1;_isUserControllingDolly=!1;_isUserControllingTruck=!1;_isUserControllingOffset=!1;_isUserControllingZoom=!1;_lastDollyDirection=D.NONE;_thetaVelocity={value:0};_phiVelocity={value:0};_radiusVelocity={value:0};_targetVelocity=new s.Vector3;_focalOffsetVelocity=new s.Vector3;_zoomVelocity={value:0};set verticalDragToForward(t){console.warn("camera-controls: `verticalDragToForward` was removed. Use `mouseButtons.left = CameraControls.ACTION.SCREEN_PAN` instead.")}constructor(t,e){super(),void 0===s&&console.error("camera-controls: `THREE` is undefined. You must first run `CameraControls.install( { THREE: THREE } )`. Check the docs for further information."),this._camera=t,this._yAxisUpSpace=new s.Quaternion().setFromUnitVectors(this._camera.up,n),this._yAxisUpSpaceInverse=this._yAxisUpSpace.clone().invert(),this._state=P.NONE,this._target=new s.Vector3,this._targetEnd=this._target.clone(),this._focalOffset=new s.Vector3,this._focalOffsetEnd=this._focalOffset.clone(),this._spherical=new s.Spherical().setFromVector3(l.copy(this._camera.position).applyQuaternion(this._yAxisUpSpace)),this._sphericalEnd=this._spherical.clone(),this._lastDistance=this._spherical.radius,this._zoom=this._camera.zoom,this._zoomEnd=this._zoom,this._lastZoom=this._zoom,this._nearPlaneCorners=[new s.Vector3,new s.Vector3,new s.Vector3,new s.Vector3],this._updateNearPlaneCorners(),this._boundary=new s.Box3(new s.Vector3(-1/0,-1/0,-1/0),new s.Vector3(1/0,1/0,1/0)),this._cameraUp0=this._camera.up.clone(),this._target0=this._target.clone(),this._position0=this._camera.position.clone(),this._zoom0=this._zoom,this._focalOffset0=this._focalOffset.clone(),this._dollyControlCoord=new s.Vector2,this.mouseButtons={left:P.ROTATE,middle:P.DOLLY,right:P.TRUCK,wheel:z(this._camera)?P.DOLLY:M(this._camera)?P.ZOOM:P.NONE},this.touches={one:P.TOUCH_ROTATE,two:z(this._camera)?P.TOUCH_DOLLY_TRUCK:M(this._camera)?P.TOUCH_ZOOM_TRUCK:P.NONE,three:P.TOUCH_TRUCK};let i=new s.Vector2,r=new s.Vector2,o=new s.Vector2,h=t=>{if(!this._enabled||!this._domElement)return;if(0!==this._interactiveArea.left||0!==this._interactiveArea.top||1!==this._interactiveArea.width||1!==this._interactiveArea.height){let e=this._domElement.getBoundingClientRect(),i=t.clientX/e.width,s=t.clientY/e.height;if(i<this._interactiveArea.left||i>this._interactiveArea.right||s<this._interactiveArea.top||s>this._interactiveArea.bottom)return}let e="mouse"!==t.pointerType?null:(t.buttons&L.LEFT)===L.LEFT?L.LEFT:(t.buttons&L.MIDDLE)===L.MIDDLE?L.MIDDLE:(t.buttons&L.RIGHT)===L.RIGHT?L.RIGHT:null;if(null!==e){let t=this._findPointerByMouseButton(e);t&&this._disposePointer(t)}if((t.buttons&L.LEFT)===L.LEFT&&this._lockedPointer)return;let i={pointerId:t.pointerId,clientX:t.clientX,clientY:t.clientY,deltaX:0,deltaY:0,mouseButton:e};this._activePointers.push(i),this._domElement.ownerDocument.removeEventListener("pointermove",c,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",d),this._domElement.ownerDocument.addEventListener("pointermove",c,{passive:!1}),this._domElement.ownerDocument.addEventListener("pointerup",d),this._isDragging=!0,p(t)},c=t=>{t.cancelable&&t.preventDefault();let e=t.pointerId,i=this._lockedPointer||this._findPointerById(e);if(i){if(i.clientX=t.clientX,i.clientY=t.clientY,i.deltaX=t.movementX,i.deltaY=t.movementY,this._state=0,"touch"===t.pointerType)switch(this._activePointers.length){case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three}else(!this._isDragging&&this._lockedPointer||this._isDragging&&(t.buttons&L.LEFT)===L.LEFT)&&(this._state=this._state|this.mouseButtons.left),this._isDragging&&(t.buttons&L.MIDDLE)===L.MIDDLE&&(this._state=this._state|this.mouseButtons.middle),this._isDragging&&(t.buttons&L.RIGHT)===L.RIGHT&&(this._state=this._state|this.mouseButtons.right);f()}},d=t=>{let e=this._findPointerById(t.pointerId);if(!e||e!==this._lockedPointer){if(e&&this._disposePointer(e),"touch"===t.pointerType)switch(this._activePointers.length){case 0:this._state=P.NONE;break;case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three}else this._state=P.NONE;g()}},u=-1,m=t=>{if(!this._domElement||!this._enabled||this.mouseButtons.wheel===P.NONE)return;if(0!==this._interactiveArea.left||0!==this._interactiveArea.top||1!==this._interactiveArea.width||1!==this._interactiveArea.height){let e=this._domElement.getBoundingClientRect(),i=t.clientX/e.width,s=t.clientY/e.height;if(i<this._interactiveArea.left||i>this._interactiveArea.right||s<this._interactiveArea.top||s>this._interactiveArea.bottom)return}if(t.preventDefault(),this.dollyToCursor||this.mouseButtons.wheel===P.ROTATE||this.mouseButtons.wheel===P.TRUCK){let t=performance.now();u-t<1e3&&this._getClientRect(this._elementRect),u=t}let e=Q?-1:-3,i=1!==t.deltaMode||t.ctrlKey?t.deltaY/(10*e):t.deltaY/e,s=this.dollyToCursor?(t.clientX-this._elementRect.x)/this._elementRect.width*2-1:0,r=this.dollyToCursor?-((t.clientY-this._elementRect.y)/this._elementRect.height*2)+1:0;switch(t.ctrlKey?P.ZOOM:this.mouseButtons.wheel){case P.ROTATE:this._rotateInternal(t.deltaX,t.deltaY),this._isUserControllingRotate=!0;break;case P.TRUCK:this._truckInternal(t.deltaX,t.deltaY,!1,!1),this._isUserControllingTruck=!0;break;case P.SCREEN_PAN:this._truckInternal(t.deltaX,t.deltaY,!1,!0),this._isUserControllingTruck=!0;break;case P.OFFSET:this._truckInternal(t.deltaX,t.deltaY,!0,!1),this._isUserControllingOffset=!0;break;case P.DOLLY:this._dollyInternal(-i,s,r),this._isUserControllingDolly=!0;break;case P.ZOOM:this._zoomInternal(-i,s,r),this._isUserControllingZoom=!0}this.dispatchEvent({type:"control"})},_=t=>{if(this._domElement&&this._enabled){if(this.mouseButtons.right===X.ACTION.NONE){let e=t instanceof PointerEvent?t.pointerId:0,i=this._findPointerById(e);i&&this._disposePointer(i),this._domElement.ownerDocument.removeEventListener("pointermove",c,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",d);return}t.preventDefault()}},p=t=>{if(this._enabled){if(G(this._activePointers,a),this._getClientRect(this._elementRect),i.copy(a),r.copy(a),this._activePointers.length>=2){let t=a.x-this._activePointers[1].clientX,e=a.y-this._activePointers[1].clientY,i=Math.sqrt(t*t+e*e);o.set(0,i);let s=(this._activePointers[0].clientX+this._activePointers[1].clientX)*.5,n=(this._activePointers[0].clientY+this._activePointers[1].clientY)*.5;r.set(s,n)}if(this._state=0,t)if("pointerType"in t&&"touch"===t.pointerType)switch(this._activePointers.length){case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three}else this._lockedPointer||(t.buttons&L.LEFT)!==L.LEFT||(this._state=this._state|this.mouseButtons.left),(t.buttons&L.MIDDLE)===L.MIDDLE&&(this._state=this._state|this.mouseButtons.middle),(t.buttons&L.RIGHT)===L.RIGHT&&(this._state=this._state|this.mouseButtons.right);else this._lockedPointer&&(this._state=this._state|this.mouseButtons.left);((this._state&P.ROTATE)===P.ROTATE||(this._state&P.TOUCH_ROTATE)===P.TOUCH_ROTATE||(this._state&P.TOUCH_DOLLY_ROTATE)===P.TOUCH_DOLLY_ROTATE||(this._state&P.TOUCH_ZOOM_ROTATE)===P.TOUCH_ZOOM_ROTATE)&&(this._sphericalEnd.theta=this._spherical.theta,this._sphericalEnd.phi=this._spherical.phi,this._thetaVelocity.value=0,this._phiVelocity.value=0),((this._state&P.TRUCK)===P.TRUCK||(this._state&P.SCREEN_PAN)===P.SCREEN_PAN||(this._state&P.TOUCH_TRUCK)===P.TOUCH_TRUCK||(this._state&P.TOUCH_SCREEN_PAN)===P.TOUCH_SCREEN_PAN||(this._state&P.TOUCH_DOLLY_TRUCK)===P.TOUCH_DOLLY_TRUCK||(this._state&P.TOUCH_DOLLY_SCREEN_PAN)===P.TOUCH_DOLLY_SCREEN_PAN||(this._state&P.TOUCH_ZOOM_TRUCK)===P.TOUCH_ZOOM_TRUCK||(this._state&P.TOUCH_ZOOM_SCREEN_PAN)===P.TOUCH_DOLLY_SCREEN_PAN)&&(this._targetEnd.copy(this._target),this._targetVelocity.set(0,0,0)),((this._state&P.DOLLY)===P.DOLLY||(this._state&P.TOUCH_DOLLY)===P.TOUCH_DOLLY||(this._state&P.TOUCH_DOLLY_TRUCK)===P.TOUCH_DOLLY_TRUCK||(this._state&P.TOUCH_DOLLY_SCREEN_PAN)===P.TOUCH_DOLLY_SCREEN_PAN||(this._state&P.TOUCH_DOLLY_OFFSET)===P.TOUCH_DOLLY_OFFSET||(this._state&P.TOUCH_DOLLY_ROTATE)===P.TOUCH_DOLLY_ROTATE)&&(this._sphericalEnd.radius=this._spherical.radius,this._radiusVelocity.value=0),((this._state&P.ZOOM)===P.ZOOM||(this._state&P.TOUCH_ZOOM)===P.TOUCH_ZOOM||(this._state&P.TOUCH_ZOOM_TRUCK)===P.TOUCH_ZOOM_TRUCK||(this._state&P.TOUCH_ZOOM_SCREEN_PAN)===P.TOUCH_ZOOM_SCREEN_PAN||(this._state&P.TOUCH_ZOOM_OFFSET)===P.TOUCH_ZOOM_OFFSET||(this._state&P.TOUCH_ZOOM_ROTATE)===P.TOUCH_ZOOM_ROTATE)&&(this._zoomEnd=this._zoom,this._zoomVelocity.value=0),((this._state&P.OFFSET)===P.OFFSET||(this._state&P.TOUCH_OFFSET)===P.TOUCH_OFFSET||(this._state&P.TOUCH_DOLLY_OFFSET)===P.TOUCH_DOLLY_OFFSET||(this._state&P.TOUCH_ZOOM_OFFSET)===P.TOUCH_ZOOM_OFFSET)&&(this._focalOffsetEnd.copy(this._focalOffset),this._focalOffsetVelocity.set(0,0,0)),this.dispatchEvent({type:"controlstart"})}},f=()=>{if(!this._enabled||!this._dragNeedsUpdate)return;this._dragNeedsUpdate=!1,G(this._activePointers,a);let t=this._domElement&&this._domElement.ownerDocument.pointerLockElement===this._domElement?this._lockedPointer||this._activePointers[0]:null,e=t?-t.deltaX:r.x-a.x,s=t?-t.deltaY:r.y-a.y;if(r.copy(a),((this._state&P.ROTATE)===P.ROTATE||(this._state&P.TOUCH_ROTATE)===P.TOUCH_ROTATE||(this._state&P.TOUCH_DOLLY_ROTATE)===P.TOUCH_DOLLY_ROTATE||(this._state&P.TOUCH_ZOOM_ROTATE)===P.TOUCH_ZOOM_ROTATE)&&(this._rotateInternal(e,s),this._isUserControllingRotate=!0),(this._state&P.DOLLY)===P.DOLLY||(this._state&P.ZOOM)===P.ZOOM){let t=this.dollyToCursor?(i.x-this._elementRect.x)/this._elementRect.width*2-1:0,e=this.dollyToCursor?-((i.y-this._elementRect.y)/this._elementRect.height*2)+1:0,r=this.dollyDragInverted?-1:1;(this._state&P.DOLLY)===P.DOLLY?(this._dollyInternal(r*s*K,t,e),this._isUserControllingDolly=!0):(this._zoomInternal(r*s*K,t,e),this._isUserControllingZoom=!0)}if((this._state&P.TOUCH_DOLLY)===P.TOUCH_DOLLY||(this._state&P.TOUCH_ZOOM)===P.TOUCH_ZOOM||(this._state&P.TOUCH_DOLLY_TRUCK)===P.TOUCH_DOLLY_TRUCK||(this._state&P.TOUCH_ZOOM_TRUCK)===P.TOUCH_ZOOM_TRUCK||(this._state&P.TOUCH_DOLLY_SCREEN_PAN)===P.TOUCH_DOLLY_SCREEN_PAN||(this._state&P.TOUCH_ZOOM_SCREEN_PAN)===P.TOUCH_ZOOM_SCREEN_PAN||(this._state&P.TOUCH_DOLLY_OFFSET)===P.TOUCH_DOLLY_OFFSET||(this._state&P.TOUCH_ZOOM_OFFSET)===P.TOUCH_ZOOM_OFFSET||(this._state&P.TOUCH_DOLLY_ROTATE)===P.TOUCH_DOLLY_ROTATE||(this._state&P.TOUCH_ZOOM_ROTATE)===P.TOUCH_ZOOM_ROTATE){let t=a.x-this._activePointers[1].clientX,e=a.y-this._activePointers[1].clientY,i=Math.sqrt(t*t+e*e),s=o.y-i;o.set(0,i);let n=this.dollyToCursor?(r.x-this._elementRect.x)/this._elementRect.width*2-1:0,l=this.dollyToCursor?-((r.y-this._elementRect.y)/this._elementRect.height*2)+1:0;(this._state&P.TOUCH_DOLLY)===P.TOUCH_DOLLY||(this._state&P.TOUCH_DOLLY_ROTATE)===P.TOUCH_DOLLY_ROTATE||(this._state&P.TOUCH_DOLLY_TRUCK)===P.TOUCH_DOLLY_TRUCK||(this._state&P.TOUCH_DOLLY_SCREEN_PAN)===P.TOUCH_DOLLY_SCREEN_PAN||(this._state&P.TOUCH_DOLLY_OFFSET)===P.TOUCH_DOLLY_OFFSET?(this._dollyInternal(s*K,n,l),this._isUserControllingDolly=!0):(this._zoomInternal(s*K,n,l),this._isUserControllingZoom=!0)}((this._state&P.TRUCK)===P.TRUCK||(this._state&P.TOUCH_TRUCK)===P.TOUCH_TRUCK||(this._state&P.TOUCH_DOLLY_TRUCK)===P.TOUCH_DOLLY_TRUCK||(this._state&P.TOUCH_ZOOM_TRUCK)===P.TOUCH_ZOOM_TRUCK)&&(this._truckInternal(e,s,!1,!1),this._isUserControllingTruck=!0),((this._state&P.SCREEN_PAN)===P.SCREEN_PAN||(this._state&P.TOUCH_SCREEN_PAN)===P.TOUCH_SCREEN_PAN||(this._state&P.TOUCH_DOLLY_SCREEN_PAN)===P.TOUCH_DOLLY_SCREEN_PAN||(this._state&P.TOUCH_ZOOM_SCREEN_PAN)===P.TOUCH_ZOOM_SCREEN_PAN)&&(this._truckInternal(e,s,!1,!0),this._isUserControllingTruck=!0),((this._state&P.OFFSET)===P.OFFSET||(this._state&P.TOUCH_OFFSET)===P.TOUCH_OFFSET||(this._state&P.TOUCH_DOLLY_OFFSET)===P.TOUCH_DOLLY_OFFSET||(this._state&P.TOUCH_ZOOM_OFFSET)===P.TOUCH_ZOOM_OFFSET)&&(this._truckInternal(e,s,!0,!1),this._isUserControllingOffset=!0),this.dispatchEvent({type:"control"})},g=()=>{G(this._activePointers,a),r.copy(a),this._dragNeedsUpdate=!1,(0===this._activePointers.length||1===this._activePointers.length&&this._activePointers[0]===this._lockedPointer)&&(this._isDragging=!1),0===this._activePointers.length&&this._domElement&&(this._domElement.ownerDocument.removeEventListener("pointermove",c,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",d),this.dispatchEvent({type:"controlend"}))};this.lockPointer=()=>{this._enabled&&this._domElement&&(this.cancel(),this._lockedPointer={pointerId:-1,clientX:0,clientY:0,deltaX:0,deltaY:0,mouseButton:null},this._activePointers.push(this._lockedPointer),this._domElement.ownerDocument.removeEventListener("pointermove",c,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",d),this._domElement.requestPointerLock(),this._domElement.ownerDocument.addEventListener("pointerlockchange",v),this._domElement.ownerDocument.addEventListener("pointerlockerror",y),this._domElement.ownerDocument.addEventListener("pointermove",c,{passive:!1}),this._domElement.ownerDocument.addEventListener("pointerup",d),p())},this.unlockPointer=()=>{null!==this._lockedPointer&&(this._disposePointer(this._lockedPointer),this._lockedPointer=null),this._domElement?.ownerDocument.exitPointerLock(),this._domElement?.ownerDocument.removeEventListener("pointerlockchange",v),this._domElement?.ownerDocument.removeEventListener("pointerlockerror",y),this.cancel()};let v=()=>{this._domElement&&this._domElement.ownerDocument.pointerLockElement===this._domElement||this.unlockPointer()},y=()=>{this.unlockPointer()};this._addAllEventListeners=t=>{this._domElement=t,this._domElement.style.touchAction="none",this._domElement.style.userSelect="none",this._domElement.style.webkitUserSelect="none",this._domElement.addEventListener("pointerdown",h),this._domElement.addEventListener("pointercancel",d),this._domElement.addEventListener("wheel",m,{passive:!1}),this._domElement.addEventListener("contextmenu",_)},this._removeAllEventListeners=()=>{this._domElement&&(this._domElement.style.touchAction="",this._domElement.style.userSelect="",this._domElement.style.webkitUserSelect="",this._domElement.removeEventListener("pointerdown",h),this._domElement.removeEventListener("pointercancel",d),this._domElement.removeEventListener("wheel",m,{passive:!1}),this._domElement.removeEventListener("contextmenu",_),this._domElement.ownerDocument.removeEventListener("pointermove",c,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",d),this._domElement.ownerDocument.removeEventListener("pointerlockchange",v),this._domElement.ownerDocument.removeEventListener("pointerlockerror",y))},this.cancel=()=>{this._state!==P.NONE&&(this._state=P.NONE,this._activePointers.length=0,g())},e&&this.connect(e),this.update(0)}get camera(){return this._camera}set camera(t){this._camera=t,this.updateCameraUp(),this._camera.updateProjectionMatrix(),this._updateNearPlaneCorners(),this._needsUpdate=!0}get enabled(){return this._enabled}set enabled(t){this._enabled=t,this._domElement&&(t?(this._domElement.style.touchAction="none",this._domElement.style.userSelect="none",this._domElement.style.webkitUserSelect="none"):(this.cancel(),this._domElement.style.touchAction="",this._domElement.style.userSelect="",this._domElement.style.webkitUserSelect=""))}get active(){return!this._hasRested}get currentAction(){return this._state}get distance(){return this._spherical.radius}set distance(t){(this._spherical.radius!==t||this._sphericalEnd.radius!==t)&&(this._spherical.radius=t,this._sphericalEnd.radius=t,this._needsUpdate=!0)}get azimuthAngle(){return this._spherical.theta}set azimuthAngle(t){(this._spherical.theta!==t||this._sphericalEnd.theta!==t)&&(this._spherical.theta=t,this._sphericalEnd.theta=t,this._needsUpdate=!0)}get polarAngle(){return this._spherical.phi}set polarAngle(t){(this._spherical.phi!==t||this._sphericalEnd.phi!==t)&&(this._spherical.phi=t,this._sphericalEnd.phi=t,this._needsUpdate=!0)}get boundaryEnclosesCamera(){return this._boundaryEnclosesCamera}set boundaryEnclosesCamera(t){this._boundaryEnclosesCamera=t,this._needsUpdate=!0}set interactiveArea(t){this._interactiveArea.width=N(t.width,0,1),this._interactiveArea.height=N(t.height,0,1),this._interactiveArea.x=N(t.x,0,1-this._interactiveArea.width),this._interactiveArea.y=N(t.y,0,1-this._interactiveArea.height)}addEventListener(t,e){super.addEventListener(t,e)}removeEventListener(t,e){super.removeEventListener(t,e)}rotate(t,e,i=!1){return this.rotateTo(this._sphericalEnd.theta+t,this._sphericalEnd.phi+e,i)}rotateAzimuthTo(t,e=!1){return this.rotateTo(t,this._sphericalEnd.phi,e)}rotatePolarTo(t,e=!1){return this.rotateTo(this._sphericalEnd.theta,t,e)}rotateTo(t,e,i=!1){this._isUserControllingRotate=!1;let s=N(t,this.minAzimuthAngle,this.maxAzimuthAngle),r=N(e,this.minPolarAngle,this.maxPolarAngle);this._sphericalEnd.theta=s,this._sphericalEnd.phi=r,this._sphericalEnd.makeSafe(),this._needsUpdate=!0,i||(this._spherical.theta=this._sphericalEnd.theta,this._spherical.phi=this._sphericalEnd.phi);let n=!i||I(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&I(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold);return this._createOnRestPromise(n)}dolly(t,e=!1){return this.dollyTo(this._sphericalEnd.radius-t,e)}dollyTo(t,e=!1){return this._isUserControllingDolly=!1,this._lastDollyDirection=D.NONE,this._changedDolly=0,this._dollyToNoClamp(N(t,this.minDistance,this.maxDistance),e)}_dollyToNoClamp(t,e=!1){let i=this._sphericalEnd.radius;if(this.colliderMeshes.length>=1){let e=this._collisionTest(),s=I(e,this._spherical.radius);if(!(i>t)&&s)return Promise.resolve();this._sphericalEnd.radius=Math.min(t,e)}else this._sphericalEnd.radius=t;this._needsUpdate=!0,e||(this._spherical.radius=this._sphericalEnd.radius);let s=!e||I(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(s)}dollyInFixed(t,e=!1){this._targetEnd.add(this._getCameraDirection(d).multiplyScalar(t)),e||this._target.copy(this._targetEnd);let i=!e||I(this._target.x,this._targetEnd.x,this.restThreshold)&&I(this._target.y,this._targetEnd.y,this.restThreshold)&&I(this._target.z,this._targetEnd.z,this.restThreshold);return this._createOnRestPromise(i)}zoom(t,e=!1){return this.zoomTo(this._zoomEnd+t,e)}zoomTo(t,e=!1){this._isUserControllingZoom=!1,this._zoomEnd=N(t,this.minZoom,this.maxZoom),this._needsUpdate=!0,e||(this._zoom=this._zoomEnd);let i=!e||I(this._zoom,this._zoomEnd,this.restThreshold);return this._changedZoom=0,this._createOnRestPromise(i)}pan(t,e,i=!1){return console.warn("`pan` has been renamed to `truck`"),this.truck(t,e,i)}truck(t,e,i=!1){this._camera.updateMatrix(),u.setFromMatrixColumn(this._camera.matrix,0),m.setFromMatrixColumn(this._camera.matrix,1),u.multiplyScalar(t),m.multiplyScalar(-e);let s=l.copy(u).add(m),r=h.copy(this._targetEnd).add(s);return this.moveTo(r.x,r.y,r.z,i)}forward(t,e=!1){l.setFromMatrixColumn(this._camera.matrix,0),l.crossVectors(this._camera.up,l),l.multiplyScalar(t);let i=h.copy(this._targetEnd).add(l);return this.moveTo(i.x,i.y,i.z,e)}elevate(t,e=!1){return l.copy(this._camera.up).multiplyScalar(t),this.moveTo(this._targetEnd.x+l.x,this._targetEnd.y+l.y,this._targetEnd.z+l.z,e)}moveTo(t,e,i,s=!1){this._isUserControllingTruck=!1;let r=l.set(t,e,i).sub(this._targetEnd);this._encloseToBoundary(this._targetEnd,r,this.boundaryFriction),this._needsUpdate=!0,s||this._target.copy(this._targetEnd);let n=!s||I(this._target.x,this._targetEnd.x,this.restThreshold)&&I(this._target.y,this._targetEnd.y,this.restThreshold)&&I(this._target.z,this._targetEnd.z,this.restThreshold);return this._createOnRestPromise(n)}lookInDirectionOf(t,e,i,s=!1){let r=l.set(t,e,i).sub(this._targetEnd).normalize().multiplyScalar(-this._sphericalEnd.radius).add(this._targetEnd);return this.setPosition(r.x,r.y,r.z,s)}fitToBox(t,e,{cover:i=!1,paddingLeft:s=0,paddingRight:r=0,paddingBottom:a=0,paddingTop:c=0}={}){let d=[],u=t.isBox3?y.copy(t):y.setFromObject(t);u.isEmpty()&&(console.warn("camera-controls: fitTo() cannot be used with an empty box. Aborting"),Promise.resolve());let m=B(this._sphericalEnd.theta,H),_=B(this._sphericalEnd.phi,H);d.push(this.rotateTo(m,_,e));let p=l.setFromSpherical(this._sphericalEnd).normalize(),f=T.setFromUnitVectors(p,o),g=I(Math.abs(p.y),1);g&&f.multiply(x.setFromAxisAngle(n,m)),f.multiply(this._yAxisUpSpaceInverse);let v=E.makeEmpty();h.copy(u.min).applyQuaternion(f),v.expandByPoint(h),h.copy(u.min).setX(u.max.x).applyQuaternion(f),v.expandByPoint(h),h.copy(u.min).setY(u.max.y).applyQuaternion(f),v.expandByPoint(h),h.copy(u.max).setZ(u.min.z).applyQuaternion(f),v.expandByPoint(h),h.copy(u.min).setZ(u.max.z).applyQuaternion(f),v.expandByPoint(h),h.copy(u.max).setY(u.min.y).applyQuaternion(f),v.expandByPoint(h),h.copy(u.max).setX(u.min.x).applyQuaternion(f),v.expandByPoint(h),h.copy(u.max).applyQuaternion(f),v.expandByPoint(h),v.min.x-=s,v.min.y-=a,v.max.x+=r,v.max.y+=c,f.setFromUnitVectors(o,p),g&&f.premultiply(x.invert()),f.premultiply(this._yAxisUpSpace);let O=v.getSize(l),C=v.getCenter(h).applyQuaternion(f);if(z(this._camera)){let t=this.getDistanceToFitBox(O.x,O.y,O.z,i);d.push(this.moveTo(C.x,C.y,C.z,e)),d.push(this.dollyTo(t,e)),d.push(this.setFocalOffset(0,0,0,e))}else if(M(this._camera)){let t=this._camera,s=t.right-t.left,r=t.top-t.bottom,n=i?Math.max(s/O.x,r/O.y):Math.min(s/O.x,r/O.y);d.push(this.moveTo(C.x,C.y,C.z,e)),d.push(this.zoomTo(n,e)),d.push(this.setFocalOffset(0,0,0,e))}return Promise.all(d)}fitToSphere(t,e){let i=[],s="isObject3D"in t?X.createBoundingSphere(t,O):O.copy(t);if(i.push(this.moveTo(s.center.x,s.center.y,s.center.z,e)),z(this._camera)){let t=this.getDistanceToFitSphere(s.radius);i.push(this.dollyTo(t,e))}else if(M(this._camera)){let t=this._camera.right-this._camera.left,r=this._camera.top-this._camera.bottom,n=2*s.radius,o=Math.min(t/n,r/n);i.push(this.zoomTo(o,e))}return i.push(this.setFocalOffset(0,0,0,e)),Promise.all(i)}setLookAt(t,e,i,s,r,n,o=!1){this._isUserControllingRotate=!1,this._isUserControllingDolly=!1,this._isUserControllingTruck=!1,this._lastDollyDirection=D.NONE,this._changedDolly=0;let a=h.set(s,r,n),c=l.set(t,e,i);this._targetEnd.copy(a),this._sphericalEnd.setFromVector3(c.sub(a).applyQuaternion(this._yAxisUpSpace)),this._needsUpdate=!0,o||(this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd));let d=!o||I(this._target.x,this._targetEnd.x,this.restThreshold)&&I(this._target.y,this._targetEnd.y,this.restThreshold)&&I(this._target.z,this._targetEnd.z,this.restThreshold)&&I(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&I(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold)&&I(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(d)}lerp(t,e,i,s=!1){this._isUserControllingRotate=!1,this._isUserControllingDolly=!1,this._isUserControllingTruck=!1,this._lastDollyDirection=D.NONE,this._changedDolly=0;let r=l.set(...t.target);if("spherical"in t)g.set(...t.spherical);else{let e=h.set(...t.position);g.setFromVector3(e.sub(r).applyQuaternion(this._yAxisUpSpace))}let n=c.set(...e.target);if("spherical"in e)v.set(...e.spherical);else{let t=h.set(...e.position);v.setFromVector3(t.sub(n).applyQuaternion(this._yAxisUpSpace))}this._targetEnd.copy(r.lerp(n,i));let o=v.theta-g.theta,a=v.phi-g.phi,d=v.radius-g.radius;this._sphericalEnd.set(g.radius+d*i,g.phi+a*i,g.theta+o*i),this._needsUpdate=!0,s||(this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd));let u=!s||I(this._target.x,this._targetEnd.x,this.restThreshold)&&I(this._target.y,this._targetEnd.y,this.restThreshold)&&I(this._target.z,this._targetEnd.z,this.restThreshold)&&I(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&I(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold)&&I(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(u)}lerpLookAt(t,e,i,s,r,n,o,a,l,h,c,d,u,m=!1){return this.lerp({position:[t,e,i],target:[s,r,n]},{position:[o,a,l],target:[h,c,d]},u,m)}setPosition(t,e,i,s=!1){return this.setLookAt(t,e,i,this._targetEnd.x,this._targetEnd.y,this._targetEnd.z,s)}setTarget(t,e,i,s=!1){let r=this.getPosition(l),n=this.setLookAt(r.x,r.y,r.z,t,e,i,s);return this._sphericalEnd.phi=N(this._sphericalEnd.phi,this.minPolarAngle,this.maxPolarAngle),n}setFocalOffset(t,e,i,s=!1){this._isUserControllingOffset=!1,this._focalOffsetEnd.set(t,e,i),this._needsUpdate=!0,s||this._focalOffset.copy(this._focalOffsetEnd);let r=!s||I(this._focalOffset.x,this._focalOffsetEnd.x,this.restThreshold)&&I(this._focalOffset.y,this._focalOffsetEnd.y,this.restThreshold)&&I(this._focalOffset.z,this._focalOffsetEnd.z,this.restThreshold);return this._createOnRestPromise(r)}setOrbitPoint(t,e,i){this._camera.updateMatrixWorld(),u.setFromMatrixColumn(this._camera.matrixWorldInverse,0),m.setFromMatrixColumn(this._camera.matrixWorldInverse,1),_.setFromMatrixColumn(this._camera.matrixWorldInverse,2);let s=l.set(t,e,i),r=s.distanceTo(this._camera.position),n=s.sub(this._camera.position);u.multiplyScalar(n.x),m.multiplyScalar(n.y),_.multiplyScalar(n.z),l.copy(u).add(m).add(_),l.z=l.z+r,this.dollyTo(r,!1),this.setFocalOffset(-l.x,l.y,-l.z,!1),this.moveTo(t,e,i,!1)}setBoundary(t){if(!t){this._boundary.min.set(-1/0,-1/0,-1/0),this._boundary.max.set(1/0,1/0,1/0),this._needsUpdate=!0;return}this._boundary.copy(t),this._boundary.clampPoint(this._targetEnd,this._targetEnd),this._needsUpdate=!0}setViewport(t,e,i,r){if(null===t){this._viewport=null;return}this._viewport=this._viewport||new s.Vector4,"number"==typeof t?this._viewport.set(t,e,i,r):this._viewport.copy(t)}getDistanceToFitBox(t,e,i,s=!1){if(W(this._camera,"getDistanceToFitBox"))return this._spherical.radius;let r=t/e,n=this._camera.getEffectiveFOV()*F,o=this._camera.aspect;return .5*((s?r>o:r<o)?e:t/o)/Math.tan(.5*n)+.5*i}getDistanceToFitSphere(t){if(W(this._camera,"getDistanceToFitSphere"))return this._spherical.radius;let e=this._camera.getEffectiveFOV()*F,i=2*Math.atan(Math.tan(.5*e)*this._camera.aspect);return t/Math.sin(.5*(1<this._camera.aspect?e:i))}getTarget(t,e=!0){return(t&&t.isVector3?t:new s.Vector3).copy(e?this._targetEnd:this._target)}getPosition(t,e=!0){return(t&&t.isVector3?t:new s.Vector3).setFromSpherical(e?this._sphericalEnd:this._spherical).applyQuaternion(this._yAxisUpSpaceInverse).add(e?this._targetEnd:this._target)}getSpherical(t,e=!0){return(t||new s.Spherical).copy(e?this._sphericalEnd:this._spherical)}getFocalOffset(t,e=!0){return(t&&t.isVector3?t:new s.Vector3).copy(e?this._focalOffsetEnd:this._focalOffset)}normalizeRotations(){return this._sphericalEnd.theta=(this._sphericalEnd.theta%R+R)%R,this._sphericalEnd.theta>Math.PI&&(this._sphericalEnd.theta-=R),this._spherical.theta+=R*Math.round((this._sphericalEnd.theta-this._spherical.theta)/R),this}stop(){this._focalOffset.copy(this._focalOffsetEnd),this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd),this._zoom=this._zoomEnd}reset(t=!1){if(!I(this._camera.up.x,this._cameraUp0.x)||!I(this._camera.up.y,this._cameraUp0.y)||!I(this._camera.up.z,this._cameraUp0.z)){this._camera.up.copy(this._cameraUp0);let t=this.getPosition(l);this.updateCameraUp(),this.setPosition(t.x,t.y,t.z)}return Promise.all([this.setLookAt(this._position0.x,this._position0.y,this._position0.z,this._target0.x,this._target0.y,this._target0.z,t),this.setFocalOffset(this._focalOffset0.x,this._focalOffset0.y,this._focalOffset0.z,t),this.zoomTo(this._zoom0,t)])}saveState(){this._cameraUp0.copy(this._camera.up),this.getTarget(this._target0),this.getPosition(this._position0),this._zoom0=this._zoom,this._focalOffset0.copy(this._focalOffset)}updateCameraUp(){this._yAxisUpSpace.setFromUnitVectors(this._camera.up,n),this._yAxisUpSpaceInverse.copy(this._yAxisUpSpace).invert()}applyCameraUp(){let t=l.subVectors(this._target,this._camera.position).normalize(),e=h.crossVectors(t,this._camera.up);this._camera.up.crossVectors(e,t).normalize(),this._camera.updateMatrixWorld();let i=this.getPosition(l);this.updateCameraUp(),this.setPosition(i.x,i.y,i.z)}update(t){let e=this._sphericalEnd.theta-this._spherical.theta,i=this._sphericalEnd.phi-this._spherical.phi,s=this._sphericalEnd.radius-this._spherical.radius,r=p.subVectors(this._targetEnd,this._target),n=f.subVectors(this._focalOffsetEnd,this._focalOffset),o=this._zoomEnd-this._zoom;if(k(e))this._thetaVelocity.value=0,this._spherical.theta=this._sphericalEnd.theta;else{let e=this._isUserControllingRotate?this.draggingSmoothTime:this.smoothTime;this._spherical.theta=Z(this._spherical.theta,this._sphericalEnd.theta,this._thetaVelocity,e,1/0,t),this._needsUpdate=!0}if(k(i))this._phiVelocity.value=0,this._spherical.phi=this._sphericalEnd.phi;else{let e=this._isUserControllingRotate?this.draggingSmoothTime:this.smoothTime;this._spherical.phi=Z(this._spherical.phi,this._sphericalEnd.phi,this._phiVelocity,e,1/0,t),this._needsUpdate=!0}if(k(s))this._radiusVelocity.value=0,this._spherical.radius=this._sphericalEnd.radius;else{let e=this._isUserControllingDolly?this.draggingSmoothTime:this.smoothTime;this._spherical.radius=Z(this._spherical.radius,this._sphericalEnd.radius,this._radiusVelocity,e,this.maxSpeed,t),this._needsUpdate=!0}if(k(r.x)&&k(r.y)&&k(r.z))this._targetVelocity.set(0,0,0),this._target.copy(this._targetEnd);else{let e=this._isUserControllingTruck?this.draggingSmoothTime:this.smoothTime;j(this._target,this._targetEnd,this._targetVelocity,e,this.maxSpeed,t,this._target),this._needsUpdate=!0}if(k(n.x)&&k(n.y)&&k(n.z))this._focalOffsetVelocity.set(0,0,0),this._focalOffset.copy(this._focalOffsetEnd);else{let e=this._isUserControllingOffset?this.draggingSmoothTime:this.smoothTime;j(this._focalOffset,this._focalOffsetEnd,this._focalOffsetVelocity,e,this.maxSpeed,t,this._focalOffset),this._needsUpdate=!0}if(k(o))this._zoomVelocity.value=0,this._zoom=this._zoomEnd;else{let e=this._isUserControllingZoom?this.draggingSmoothTime:this.smoothTime;this._zoom=Z(this._zoom,this._zoomEnd,this._zoomVelocity,e,1/0,t)}if(this.dollyToCursor){if(z(this._camera)&&0!==this._changedDolly){let t=this._spherical.radius-this._lastDistance,e=this._camera,i=this._getCameraDirection(d),s=l.copy(i).cross(e.up).normalize();0===s.lengthSq()&&(s.x=1);let r=h.crossVectors(s,i),n=this._sphericalEnd.radius*Math.tan(e.getEffectiveFOV()*F*.5),o=(this._sphericalEnd.radius-t-this._sphericalEnd.radius)/this._sphericalEnd.radius,a=c.copy(this._targetEnd).add(s.multiplyScalar(this._dollyControlCoord.x*n*e.aspect)).add(r.multiplyScalar(this._dollyControlCoord.y*n)),u=l.copy(this._targetEnd).lerp(a,o),m=this._lastDollyDirection===D.IN&&this._spherical.radius<=this.minDistance,_=this._lastDollyDirection===D.OUT&&this.maxDistance<=this._spherical.radius;if(this.infinityDolly&&(m||_)){this._sphericalEnd.radius-=t,this._spherical.radius-=t;let e=h.copy(i).multiplyScalar(-t);u.add(e)}this._boundary.clampPoint(u,u);let p=h.subVectors(u,this._targetEnd);this._targetEnd.copy(u),this._target.add(p),this._changedDolly-=t,k(this._changedDolly)&&(this._changedDolly=0)}else if(M(this._camera)&&0!==this._changedZoom){let t=this._zoom-this._lastZoom,e=this._camera,i=l.set(this._dollyControlCoord.x,this._dollyControlCoord.y,(e.near+e.far)/(e.near-e.far)).unproject(e),s=h.set(0,0,-1).applyQuaternion(e.quaternion),r=c.copy(i).add(s.multiplyScalar(-i.dot(e.up))),n=-(this._zoom-t-this._zoom)/this._zoom,o=this._getCameraDirection(d),a=this._targetEnd.dot(o),u=l.copy(this._targetEnd).lerp(r,n),m=u.dot(o),_=o.multiplyScalar(m-a);u.sub(_),this._boundary.clampPoint(u,u);let p=h.subVectors(u,this._targetEnd);this._targetEnd.copy(u),this._target.add(p),this._changedZoom-=t,k(this._changedZoom)&&(this._changedZoom=0)}}this._camera.zoom!==this._zoom&&(this._camera.zoom=this._zoom,this._camera.updateProjectionMatrix(),this._updateNearPlaneCorners(),this._needsUpdate=!0),this._dragNeedsUpdate=!0;let a=this._collisionTest();this._spherical.radius=Math.min(this._spherical.radius,a),this._spherical.makeSafe(),this._camera.position.setFromSpherical(this._spherical).applyQuaternion(this._yAxisUpSpaceInverse).add(this._target),this._camera.lookAt(this._target),k(this._focalOffset.x)&&k(this._focalOffset.y)&&k(this._focalOffset.z)||(this._camera.matrix.compose(this._camera.position,this._camera.quaternion,this._camera.scale),u.setFromMatrixColumn(this._camera.matrix,0),m.setFromMatrixColumn(this._camera.matrix,1),_.setFromMatrixColumn(this._camera.matrix,2),u.multiplyScalar(this._focalOffset.x),m.multiplyScalar(-this._focalOffset.y),_.multiplyScalar(this._focalOffset.z),l.copy(u).add(m).add(_),this._camera.position.add(l),this._camera.updateMatrixWorld()),this._boundaryEnclosesCamera&&this._encloseToBoundary(this._camera.position.copy(this._target),l.setFromSpherical(this._spherical).applyQuaternion(this._yAxisUpSpaceInverse),1);let g=this._needsUpdate;return g&&!this._updatedLastTime?(this._hasRested=!1,this.dispatchEvent({type:"wake"}),this.dispatchEvent({type:"update"})):g?(this.dispatchEvent({type:"update"}),k(e,this.restThreshold)&&k(i,this.restThreshold)&&k(s,this.restThreshold)&&k(r.x,this.restThreshold)&&k(r.y,this.restThreshold)&&k(r.z,this.restThreshold)&&k(n.x,this.restThreshold)&&k(n.y,this.restThreshold)&&k(n.z,this.restThreshold)&&k(o,this.restThreshold)&&!this._hasRested&&(this._hasRested=!0,this.dispatchEvent({type:"rest"}))):!g&&this._updatedLastTime&&this.dispatchEvent({type:"sleep"}),this._lastDistance=this._spherical.radius,this._lastZoom=this._zoom,this._updatedLastTime=g,this._needsUpdate=!1,g}toJSON(){return JSON.stringify({enabled:this._enabled,minDistance:this.minDistance,maxDistance:V(this.maxDistance),minZoom:this.minZoom,maxZoom:V(this.maxZoom),minPolarAngle:this.minPolarAngle,maxPolarAngle:V(this.maxPolarAngle),minAzimuthAngle:V(this.minAzimuthAngle),maxAzimuthAngle:V(this.maxAzimuthAngle),smoothTime:this.smoothTime,draggingSmoothTime:this.draggingSmoothTime,dollySpeed:this.dollySpeed,truckSpeed:this.truckSpeed,dollyToCursor:this.dollyToCursor,target:this._targetEnd.toArray(),position:l.setFromSpherical(this._sphericalEnd).add(this._targetEnd).toArray(),zoom:this._zoomEnd,focalOffset:this._focalOffsetEnd.toArray(),target0:this._target0.toArray(),position0:this._position0.toArray(),zoom0:this._zoom0,focalOffset0:this._focalOffset0.toArray()})}fromJSON(t,e=!1){let i=JSON.parse(t);this.enabled=i.enabled,this.minDistance=i.minDistance,this.maxDistance=Y(i.maxDistance),this.minZoom=i.minZoom,this.maxZoom=Y(i.maxZoom),this.minPolarAngle=i.minPolarAngle,this.maxPolarAngle=Y(i.maxPolarAngle),this.minAzimuthAngle=Y(i.minAzimuthAngle),this.maxAzimuthAngle=Y(i.maxAzimuthAngle),this.smoothTime=i.smoothTime,this.draggingSmoothTime=i.draggingSmoothTime,this.dollySpeed=i.dollySpeed,this.truckSpeed=i.truckSpeed,this.dollyToCursor=i.dollyToCursor,this._target0.fromArray(i.target0),this._position0.fromArray(i.position0),this._zoom0=i.zoom0,this._focalOffset0.fromArray(i.focalOffset0),this.moveTo(i.target[0],i.target[1],i.target[2],e),g.setFromVector3(l.fromArray(i.position).sub(this._targetEnd).applyQuaternion(this._yAxisUpSpace)),this.rotateTo(g.theta,g.phi,e),this.dollyTo(g.radius,e),this.zoomTo(i.zoom,e),this.setFocalOffset(i.focalOffset[0],i.focalOffset[1],i.focalOffset[2],e),this._needsUpdate=!0}connect(t){if(this._domElement)return void console.warn("camera-controls is already connected.");t.setAttribute("data-camera-controls-version","3.1.2"),this._addAllEventListeners(t),this._getClientRect(this._elementRect)}disconnect(){this.cancel(),this._removeAllEventListeners(),this._domElement&&(this._domElement.removeAttribute("data-camera-controls-version"),this._domElement=void 0)}dispose(){this.removeAllEventListeners(),this.disconnect()}_getTargetDirection(t){return t.setFromSpherical(this._spherical).divideScalar(this._spherical.radius).applyQuaternion(this._yAxisUpSpaceInverse)}_getCameraDirection(t){return this._getTargetDirection(t).negate()}_findPointerById(t){return this._activePointers.find(e=>e.pointerId===t)}_findPointerByMouseButton(t){return this._activePointers.find(e=>e.mouseButton===t)}_disposePointer(t){this._activePointers.splice(this._activePointers.indexOf(t),1)}_encloseToBoundary(t,e,i){let s=e.lengthSq();if(0===s)return t;let r=h.copy(e).add(t),n=this._boundary.clampPoint(r,c).sub(r),o=n.lengthSq();if(0===o)return t.add(e);{if(o===s)return t;if(0===i)return t.add(e).add(n);let r=1+i*o/e.dot(n);return t.add(h.copy(e).multiplyScalar(r)).add(n.multiplyScalar(1-i))}}_updateNearPlaneCorners(){if(z(this._camera)){let t=this._camera,e=t.near,i=Math.tan(.5*(t.getEffectiveFOV()*F))*e,s=i*t.aspect;this._nearPlaneCorners[0].set(-s,-i,0),this._nearPlaneCorners[1].set(s,-i,0),this._nearPlaneCorners[2].set(s,i,0),this._nearPlaneCorners[3].set(-s,i,0)}else if(M(this._camera)){let t=this._camera,e=1/t.zoom,i=t.left*e,s=t.right*e,r=t.top*e,n=t.bottom*e;this._nearPlaneCorners[0].set(i,r,0),this._nearPlaneCorners[1].set(s,r,0),this._nearPlaneCorners[2].set(s,n,0),this._nearPlaneCorners[3].set(i,n,0)}}_truckInternal=(t,e,i,s)=>{let r,n;if(z(this._camera)){let i=l.copy(this._camera.position).sub(this._target),s=this._camera.getEffectiveFOV()*F,o=i.length()*Math.tan(.5*s);r=this.truckSpeed*t*o/this._elementRect.height,n=this.truckSpeed*e*o/this._elementRect.height}else{if(!M(this._camera))return;let i=this._camera;r=this.truckSpeed*t*(i.right-i.left)/i.zoom/this._elementRect.width,n=this.truckSpeed*e*(i.top-i.bottom)/i.zoom/this._elementRect.height}s?(i?this.setFocalOffset(this._focalOffsetEnd.x+r,this._focalOffsetEnd.y,this._focalOffsetEnd.z,!0):this.truck(r,0,!0),this.forward(-n,!0)):i?this.setFocalOffset(this._focalOffsetEnd.x+r,this._focalOffsetEnd.y+n,this._focalOffsetEnd.z,!0):this.truck(r,n,!0)};_rotateInternal=(t,e)=>{let i=R*this.azimuthRotateSpeed*t/this._elementRect.height,s=R*this.polarRotateSpeed*e/this._elementRect.height;this.rotate(i,s,!0)};_dollyInternal=(t,e,i)=>{let s=Math.pow(.95,-t*this.dollySpeed),r=this._sphericalEnd.radius,n=this._sphericalEnd.radius*s,o=N(n,this.minDistance,this.maxDistance),a=o-n;this.infinityDolly&&this.dollyToCursor?this._dollyToNoClamp(n,!0):(this.infinityDolly&&!this.dollyToCursor&&this.dollyInFixed(a,!0),this._dollyToNoClamp(o,!0)),this.dollyToCursor&&(this._changedDolly+=(this.infinityDolly?n:o)-r,this._dollyControlCoord.set(e,i)),this._lastDollyDirection=Math.sign(-t)};_zoomInternal=(t,e,i)=>{let s=Math.pow(.95,t*this.dollySpeed),r=this._zoom,n=this._zoom*s;this.zoomTo(n,!0),this.dollyToCursor&&(this._changedZoom+=n-r,this._dollyControlCoord.set(e,i))};_collisionTest(){let t=1/0;if(!(this.colliderMeshes.length>=1)||W(this._camera,"_collisionTest"))return t;let e=this._getTargetDirection(d);C.lookAt(r,e,this._camera.up);for(let i=0;i<4;i++){let s=h.copy(this._nearPlaneCorners[i]);s.applyMatrix4(C);let r=c.addVectors(this._target,s);U.set(r,e),U.far=this._spherical.radius+1;let n=U.intersectObjects(this.colliderMeshes);0!==n.length&&n[0].distance<t&&(t=n[0].distance)}return t}_getClientRect(t){if(!this._domElement)return;let e=this._domElement.getBoundingClientRect();return t.x=e.left,t.y=e.top,this._viewport?(t.x+=this._viewport.x,t.y+=e.height-this._viewport.w-this._viewport.y,t.width=this._viewport.z,t.height=this._viewport.w):(t.width=e.width,t.height=e.height),t}_createOnRestPromise(t){return t?Promise.resolve():(this._hasRested=!1,this.dispatchEvent({type:"transitionstart"}),new Promise(t=>{let e=()=>{this.removeEventListener("rest",e),t()};this.addEventListener("rest",e)}))}_addAllEventListeners(t){}_removeAllEventListeners(){}get dampingFactor(){return console.warn(".dampingFactor has been deprecated. use smoothTime (in seconds) instead."),0}set dampingFactor(t){console.warn(".dampingFactor has been deprecated. use smoothTime (in seconds) instead.")}get draggingDampingFactor(){return console.warn(".draggingDampingFactor has been deprecated. use draggingSmoothTime (in seconds) instead."),0}set draggingDampingFactor(t){console.warn(".draggingDampingFactor has been deprecated. use draggingSmoothTime (in seconds) instead.")}static createBoundingSphere(t,e=new s.Sphere){let i=e.center;y.makeEmpty(),t.traverseVisible(t=>{t.isMesh&&y.expandByObject(t)}),y.getCenter(i);let r=0;return t.traverseVisible(t=>{if(!t.isMesh||!t.geometry)return;let e=t.geometry.clone();e.applyMatrix4(t.matrixWorld);let s=e.attributes.position;for(let t=0,e=s.count;t<e;t++)l.fromBufferAttribute(s,t),r=Math.max(r,i.distanceToSquared(l))}),e.radius=Math.sqrt(r),e}}let $=(0,b.forwardRef)((t,e)=>{let{impl:i,camera:s,domElement:r,makeDefault:n,onControlStart:o,onControl:a,onControlEnd:l,onTransitionStart:h,onUpdate:c,onWake:d,onRest:u,onSleep:m,onStart:_,onEnd:p,onChange:f,regress:g,...v}=t,y=null!=i?i:X;(0,b.useMemo)(()=>{let t={Box3:S.NRn,MathUtils:{clamp:S.cj9.clamp},Matrix4:S.kn4,Quaternion:S.PTz,Raycaster:S.tBo,Sphere:S.iyt,Spherical:S.YHV,Vector2:S.I9Y,Vector3:S.Pq0,Vector4:S.IUQ};y.install({THREE:t}),(0,A.e)({CameraControlsImpl:y})},[y]);let E=(0,A.D)(t=>t.camera),O=(0,A.D)(t=>t.gl),T=(0,A.D)(t=>t.invalidate),x=(0,A.D)(t=>t.events),C=(0,A.D)(t=>t.setEvents),U=(0,A.D)(t=>t.set),L=(0,A.D)(t=>t.get),P=(0,A.D)(t=>t.performance),D=s||E,z=r||x.connected||O.domElement,M=(0,b.useMemo)(()=>new y(D),[y,D]);return(0,A.F)((t,e)=>{M.update(e)},-1),(0,b.useEffect)(()=>(M.connect(z),()=>void M.disconnect()),[z,M]),(0,b.useEffect)(()=>{function t(){T(),g&&P.regress()}let e=e=>{t(),null==o||o(e),null==_||_(e)},i=e=>{t(),null==a||a(e),null==f||f(e)},s=t=>{null==l||l(t),null==p||p(t)},r=e=>{t(),null==h||h(e),null==f||f(e)},n=e=>{t(),null==c||c(e),null==f||f(e)},v=e=>{t(),null==d||d(e),null==f||f(e)},y=t=>{null==u||u(t)},E=t=>{null==m||m(t)};return M.addEventListener("controlstart",e),M.addEventListener("control",i),M.addEventListener("controlend",s),M.addEventListener("transitionstart",r),M.addEventListener("update",n),M.addEventListener("wake",v),M.addEventListener("rest",y),M.addEventListener("sleep",E),()=>{M.removeEventListener("controlstart",e),M.removeEventListener("control",i),M.removeEventListener("controlend",s),M.removeEventListener("transitionstart",r),M.removeEventListener("update",n),M.removeEventListener("wake",v),M.removeEventListener("rest",y),M.removeEventListener("sleep",E)}},[M,T,C,g,P,o,a,l,h,c,d,u,m,f,_,p]),(0,b.useEffect)(()=>{if(n){let t=L().controls;return U({controls:M}),()=>U({controls:t})}},[n,M]),b.createElement("primitive",(0,w.A)({ref:e,object:M},v))})},65723:(t,e,i)=>{i.d(e,{j:()=>o});var s=i(66033);let r=new s.Pq0;function n(t,e,i,s,n,o){let a=2*Math.PI*n/4,l=Math.max(o-2*n,0),h=Math.PI/4;r.copy(e),r[s]=0,r.normalize();let c=.5*a/(a+l),d=1-r.angleTo(t)/h;return 1===Math.sign(r[i])?d*c:l/(a+l)+c+c*(1-d)}class o extends s.iNn{constructor(t=1,e=1,i=1,r=2,o=.1){let a=2*r+1;if(o=Math.min(t/2,e/2,i/2,o),super(1,1,1,a,a,a),this.type="RoundedBoxGeometry",this.parameters={width:t,height:e,depth:i,segments:r,radius:o},1===a)return;let l=this.toNonIndexed();this.index=null,this.attributes.position=l.attributes.position,this.attributes.normal=l.attributes.normal,this.attributes.uv=l.attributes.uv;let h=new s.Pq0,c=new s.Pq0,d=new s.Pq0(t,e,i).divideScalar(2).subScalar(o),u=this.attributes.position.array,m=this.attributes.normal.array,_=this.attributes.uv.array,p=u.length/6,f=new s.Pq0,g=.5/a;for(let s=0,r=0;s<u.length;s+=3,r+=2)switch(h.fromArray(u,s),c.copy(h),c.x-=Math.sign(c.x)*g,c.y-=Math.sign(c.y)*g,c.z-=Math.sign(c.z)*g,c.normalize(),u[s+0]=d.x*Math.sign(h.x)+c.x*o,u[s+1]=d.y*Math.sign(h.y)+c.y*o,u[s+2]=d.z*Math.sign(h.z)+c.z*o,m[s+0]=c.x,m[s+1]=c.y,m[s+2]=c.z,Math.floor(s/p)){case 0:f.set(1,0,0),_[r+0]=n(f,c,"z","y",o,i),_[r+1]=1-n(f,c,"y","z",o,e);break;case 1:f.set(-1,0,0),_[r+0]=1-n(f,c,"z","y",o,i),_[r+1]=1-n(f,c,"y","z",o,e);break;case 2:f.set(0,1,0),_[r+0]=1-n(f,c,"x","z",o,t),_[r+1]=n(f,c,"z","x",o,i);break;case 3:f.set(0,-1,0),_[r+0]=1-n(f,c,"x","z",o,t),_[r+1]=1-n(f,c,"z","x",o,i);break;case 4:f.set(0,0,1),_[r+0]=1-n(f,c,"x","y",o,t),_[r+1]=1-n(f,c,"y","x",o,e);break;case 5:f.set(0,0,-1),_[r+0]=n(f,c,"x","y",o,t),_[r+1]=1-n(f,c,"y","x",o,e)}}static fromJSON(t){return new o(t.width,t.height,t.depth,t.segments,t.radius)}}},90934:(t,e,i)=>{let s,r;i.d(e,{N:()=>z});var n=i(2111),o=i(1521),a=i(66033),l=i(20933);let h=new a.NRn,c=new a.Pq0;class d extends a.CmU{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type="LineSegmentsGeometry",this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute("position",new a.qtW([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute("uv",new a.qtW([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(t){let e=this.attributes.instanceStart,i=this.attributes.instanceEnd;return void 0!==e&&(e.applyMatrix4(t),i.applyMatrix4(t),e.needsUpdate=!0),null!==this.boundingBox&&this.computeBoundingBox(),null!==this.boundingSphere&&this.computeBoundingSphere(),this}setPositions(t){let e;t instanceof Float32Array?e=t:Array.isArray(t)&&(e=new Float32Array(t));let i=new a.LuO(e,6,1);return this.setAttribute("instanceStart",new a.eHs(i,3,0)),this.setAttribute("instanceEnd",new a.eHs(i,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(t,e=3){let i;t instanceof Float32Array?i=t:Array.isArray(t)&&(i=new Float32Array(t));let s=new a.LuO(i,2*e,1);return this.setAttribute("instanceColorStart",new a.eHs(s,e,0)),this.setAttribute("instanceColorEnd",new a.eHs(s,e,e)),this}fromWireframeGeometry(t){return this.setPositions(t.attributes.position.array),this}fromEdgesGeometry(t){return this.setPositions(t.attributes.position.array),this}fromMesh(t){return this.fromWireframeGeometry(new a.XJ7(t.geometry)),this}fromLineSegments(t){let e=t.geometry;return this.setPositions(e.attributes.position.array),this}computeBoundingBox(){null===this.boundingBox&&(this.boundingBox=new a.NRn);let t=this.attributes.instanceStart,e=this.attributes.instanceEnd;void 0!==t&&void 0!==e&&(this.boundingBox.setFromBufferAttribute(t),h.setFromBufferAttribute(e),this.boundingBox.union(h))}computeBoundingSphere(){null===this.boundingSphere&&(this.boundingSphere=new a.iyt),null===this.boundingBox&&this.computeBoundingBox();let t=this.attributes.instanceStart,e=this.attributes.instanceEnd;if(void 0!==t&&void 0!==e){let i=this.boundingSphere.center;this.boundingBox.getCenter(i);let s=0;for(let r=0,n=t.count;r<n;r++)c.fromBufferAttribute(t,r),s=Math.max(s,i.distanceToSquared(c)),c.fromBufferAttribute(e,r),s=Math.max(s,i.distanceToSquared(c));this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",this)}}toJSON(){}applyMatrix(t){return console.warn("THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4()."),this.applyMatrix4(t)}}var u=i(95690),m=i(73816);class _ extends a.BKk{constructor(t){super({type:"LineMaterial",uniforms:a.LlO.clone(a.LlO.merge([u.UniformsLib.common,u.UniformsLib.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new a.I9Y(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${m.r>=154?"colorspace_fragment":"encodings_fragment"}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA="1":delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(t){this.uniforms.diffuse.value=t}},worldUnits:{enumerable:!0,get:function(){return"WORLD_UNITS"in this.defines},set:function(t){!0===t?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(t){this.uniforms.linewidth.value=t}},dashed:{enumerable:!0,get:function(){return"USE_DASH"in this.defines},set(t){!!t!="USE_DASH"in this.defines&&(this.needsUpdate=!0),!0===t?this.defines.USE_DASH="":delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(t){this.uniforms.dashScale.value=t}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(t){this.uniforms.dashSize.value=t}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(t){this.uniforms.dashOffset.value=t}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(t){this.uniforms.gapSize.value=t}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(t){this.uniforms.opacity.value=t}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(t){this.uniforms.resolution.value.copy(t)}},alphaToCoverage:{enumerable:!0,get:function(){return"USE_ALPHA_TO_COVERAGE"in this.defines},set:function(t){!!t!="USE_ALPHA_TO_COVERAGE"in this.defines&&(this.needsUpdate=!0),!0===t?(this.defines.USE_ALPHA_TO_COVERAGE="",this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(t)}}let p=m.r>=125?"uv1":"uv2",f=new a.IUQ,g=new a.Pq0,v=new a.Pq0,y=new a.IUQ,E=new a.IUQ,O=new a.IUQ,T=new a.Pq0,x=new a.kn4,C=new a.cZY,U=new a.Pq0,w=new a.NRn,S=new a.iyt,b=new a.IUQ;function A(t,e,i){return b.set(0,0,-e,1).applyMatrix4(t.projectionMatrix),b.multiplyScalar(1/b.w),b.x=r/i.width,b.y=r/i.height,b.applyMatrix4(t.projectionMatrixInverse),b.multiplyScalar(1/b.w),Math.abs(Math.max(b.x,b.y))}class L extends a.eaF{constructor(t=new d,e=new _({color:0xffffff*Math.random()})){super(t,e),this.isLineSegments2=!0,this.type="LineSegments2"}computeLineDistances(){let t=this.geometry,e=t.attributes.instanceStart,i=t.attributes.instanceEnd,s=new Float32Array(2*e.count);for(let t=0,r=0,n=e.count;t<n;t++,r+=2)g.fromBufferAttribute(e,t),v.fromBufferAttribute(i,t),s[r]=0===r?0:s[r-1],s[r+1]=s[r]+g.distanceTo(v);let r=new a.LuO(s,2,1);return t.setAttribute("instanceDistanceStart",new a.eHs(r,1,0)),t.setAttribute("instanceDistanceEnd",new a.eHs(r,1,1)),this}raycast(t,e){let i,n,o=this.material.worldUnits,l=t.camera;null!==l||o||console.error('LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.');let h=void 0!==t.params.Line2&&t.params.Line2.threshold||0;s=t.ray;let c=this.matrixWorld,d=this.geometry,u=this.material;if(r=u.linewidth+h,null===d.boundingSphere&&d.computeBoundingSphere(),S.copy(d.boundingSphere).applyMatrix4(c),o)i=.5*r;else{let t=Math.max(l.near,S.distanceToPoint(s.origin));i=A(l,t,u.resolution)}if(S.radius+=i,!1!==s.intersectsSphere(S)){if(null===d.boundingBox&&d.computeBoundingBox(),w.copy(d.boundingBox).applyMatrix4(c),o)n=.5*r;else{let t=Math.max(l.near,w.distanceToPoint(s.origin));n=A(l,t,u.resolution)}w.expandByScalar(n),!1!==s.intersectsBox(w)&&(o?function(t,e){let i=t.matrixWorld,n=t.geometry,o=n.attributes.instanceStart,l=n.attributes.instanceEnd,h=Math.min(n.instanceCount,o.count);for(let n=0;n<h;n++){C.start.fromBufferAttribute(o,n),C.end.fromBufferAttribute(l,n),C.applyMatrix4(i);let h=new a.Pq0,c=new a.Pq0;s.distanceSqToSegment(C.start,C.end,c,h),c.distanceTo(h)<.5*r&&e.push({point:c,pointOnLine:h,distance:s.origin.distanceTo(c),object:t,face:null,faceIndex:n,uv:null,[p]:null})}}(this,e):function(t,e,i){let n=e.projectionMatrix,o=t.material.resolution,l=t.matrixWorld,h=t.geometry,c=h.attributes.instanceStart,d=h.attributes.instanceEnd,u=Math.min(h.instanceCount,c.count),m=-e.near;s.at(1,O),O.w=1,O.applyMatrix4(e.matrixWorldInverse),O.applyMatrix4(n),O.multiplyScalar(1/O.w),O.x*=o.x/2,O.y*=o.y/2,O.z=0,T.copy(O),x.multiplyMatrices(e.matrixWorldInverse,l);for(let e=0;e<u;e++){if(y.fromBufferAttribute(c,e),E.fromBufferAttribute(d,e),y.w=1,E.w=1,y.applyMatrix4(x),E.applyMatrix4(x),y.z>m&&E.z>m)continue;if(y.z>m){let t=y.z-E.z,e=(y.z-m)/t;y.lerp(E,e)}else if(E.z>m){let t=E.z-y.z,e=(E.z-m)/t;E.lerp(y,e)}y.applyMatrix4(n),E.applyMatrix4(n),y.multiplyScalar(1/y.w),E.multiplyScalar(1/E.w),y.x*=o.x/2,y.y*=o.y/2,E.x*=o.x/2,E.y*=o.y/2,C.start.copy(y),C.start.z=0,C.end.copy(E),C.end.z=0;let h=C.closestPointToPointParameter(T,!0);C.at(h,U);let u=a.cj9.lerp(y.z,E.z,h),_=u>=-1&&u<=1,f=T.distanceTo(U)<.5*r;if(_&&f){C.start.fromBufferAttribute(c,e),C.end.fromBufferAttribute(d,e),C.start.applyMatrix4(l),C.end.applyMatrix4(l);let r=new a.Pq0,n=new a.Pq0;s.distanceSqToSegment(C.start,C.end,n,r),i.push({point:n,pointOnLine:r,distance:s.origin.distanceTo(n),object:t,face:null,faceIndex:e,uv:null,[p]:null})}}}(this,l,e))}}onBeforeRender(t){let e=this.material.uniforms;e&&e.resolution&&(t.getViewport(f),this.material.uniforms.resolution.value.set(f.z,f.w))}}class P extends d{constructor(){super(),this.isLineGeometry=!0,this.type="LineGeometry"}setPositions(t){let e=t.length-3,i=new Float32Array(2*e);for(let s=0;s<e;s+=3)i[2*s]=t[s],i[2*s+1]=t[s+1],i[2*s+2]=t[s+2],i[2*s+3]=t[s+3],i[2*s+4]=t[s+4],i[2*s+5]=t[s+5];return super.setPositions(i),this}setColors(t,e=3){let i=t.length-e,s=new Float32Array(2*i);if(3===e)for(let r=0;r<i;r+=e)s[2*r]=t[r],s[2*r+1]=t[r+1],s[2*r+2]=t[r+2],s[2*r+3]=t[r+3],s[2*r+4]=t[r+4],s[2*r+5]=t[r+5];else for(let r=0;r<i;r+=e)s[2*r]=t[r],s[2*r+1]=t[r+1],s[2*r+2]=t[r+2],s[2*r+3]=t[r+3],s[2*r+4]=t[r+4],s[2*r+5]=t[r+5],s[2*r+6]=t[r+6],s[2*r+7]=t[r+7];return super.setColors(s,e),this}fromLine(t){let e=t.geometry;return this.setPositions(e.attributes.position.array),this}}class D extends L{constructor(t=new P,e=new _({color:0xffffff*Math.random()})){super(t,e),this.isLine2=!0,this.type="Line2"}}let z=o.forwardRef(function({points:t,color:e=0xffffff,vertexColors:i,linewidth:s,lineWidth:r,segments:h,dashed:c,...u},m){var p,f;let g=(0,l.D)(t=>t.size),v=o.useMemo(()=>h?new L:new D,[h]),[y]=o.useState(()=>new _),E=(null==i||null==(p=i[0])?void 0:p.length)===4?4:3,O=o.useMemo(()=>{let s=h?new d:new P,r=t.map(t=>{let e=Array.isArray(t);return t instanceof a.Pq0||t instanceof a.IUQ?[t.x,t.y,t.z]:t instanceof a.I9Y?[t.x,t.y,0]:e&&3===t.length?[t[0],t[1],t[2]]:e&&2===t.length?[t[0],t[1],0]:t});if(s.setPositions(r.flat()),i){e=0xffffff;let t=i.map(t=>t instanceof a.Q1f?t.toArray():t);s.setColors(t.flat(),E)}return s},[t,h,i,E]);return o.useLayoutEffect(()=>{v.computeLineDistances()},[t,v]),o.useLayoutEffect(()=>{c?y.defines.USE_DASH="":delete y.defines.USE_DASH,y.needsUpdate=!0},[c,y]),o.useEffect(()=>()=>{O.dispose(),y.dispose()},[O]),o.createElement("primitive",(0,n.A)({object:v,ref:m},u),o.createElement("primitive",{object:O,attach:"geometry"}),o.createElement("primitive",(0,n.A)({object:y,attach:"material",color:e,vertexColors:!!i,resolution:[g.width,g.height],linewidth:null!=(f=null!=s?s:r)?f:1,dashed:c,transparent:4===E},u)))})}}]);