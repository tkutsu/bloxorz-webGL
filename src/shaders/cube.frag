	precision mediump float;//necessary code for compatibility
    varying vec4 vColor;//Variable coming from the vertex shader
	varying vec2 vTextureCoord;//Variable coming from the vertex shader
	//varying vec3 vLighting;
	
	uniform sampler2D uSampler;
	
    	void main(void) {
		gl_FragColor = texture2D(uSampler, vTextureCoord)*vColor;
		//vec4 texelColor = texture2D(uSampler, vTextureCoord)*vColor;//computed by fetching the texel (texture pixel) that sampler corresponds to fragment's position
		//gl_FragColor = vec4(texelColor.rgb*vLighting, texelColor.a);//computing fragment color after lighting
    }
