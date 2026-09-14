    	attribute vec3 aVertexPosition;//attributes for the vertex shader (different for every thread/core that will execute a copy of this)
    	attribute vec4 aVertexColor;
	attribute vec2 aTextureCoord;
	//attribute vec3 aVertexNormal;
	
	//uniform mat4 uNormalMatrix;
    	uniform mat4 uMVMatrix;//ModelView and Projection Matrices
    	uniform mat4 uPMatrix;
	
    	varying vec4 vColor;//Variables to be forwarded to the corresponding thread of the fragment shader
	varying vec2 vTextureCoord;
	//varying vec3 vLighting;
	
	void main(void) {//this code will be copied to many shader cores/threads and executed with the associated data for every vertex (matrices, color, etc)
		
		gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);//Each vertex multiplied with ModelView and Projection matrices,creating a fragment
        	vColor = aVertexColor;//Its color is forwarded to the fragment shader
		vTextureCoord = aTextureCoord;//Its texture coords are forwarded to the fragment shader

		//vec3 ambientLight = vec3(0.7, 0.7, 0.7);//ambient light color
		//vec3 directionalLightColor = vec3(0.3, 1.0, 0.5);//directional light color
		//vec3 directionalVector = vec3(0.85, 0.8, 0.75);//direction that light is coming from
		//vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 1.0);
		//float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
		//vLighting = ambientLight + (directionalLightColor * directional);
    	}
