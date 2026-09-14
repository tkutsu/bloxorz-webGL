#version 300 es
//code for vertex shader: runs once per vertex, in parallel on the GPU
in vec3 aVertexPosition;
in vec4 aVertexColor;
in vec2 aTextureCoord;
//in vec3 aVertexNormal;

//uniform mat4 uNormalMatrix;
uniform mat4 uMVMatrix;//ModelView and Projection Matrices
uniform mat4 uPMatrix;

out vec4 vColor;//Variables to be forwarded to the corresponding thread of the fragment shader
out vec2 vTextureCoord;
//out vec3 vLighting;

void main(void) {
	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);//Each vertex multiplied with ModelView and Projection matrices
	vColor = aVertexColor;
	vTextureCoord = aTextureCoord;

	//vec3 ambientLight = vec3(0.7, 0.7, 0.7);//ambient light color
	//vec3 directionalLightColor = vec3(0.3, 1.0, 0.5);//directional light color
	//vec3 directionalVector = vec3(0.85, 0.8, 0.75);//direction that light is coming from
	//vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 1.0);
	//float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
	//vLighting = ambientLight + (directionalLightColor * directional);
}
