#version 300 es
//code for vertex shader: runs once per vertex, in parallel on the GPU
in vec3 aVertexPosition;
in vec4 aVertexColor;
in vec2 aTextureCoord;
in vec3 aVertexNormal;

uniform mat3 uNormalMatrix;//rotates normals along with the model, undoing non-uniform scale
uniform mat4 uMVMatrix;//ModelView and Projection Matrices
uniform mat4 uPMatrix;

out vec4 vColor;//Variables to be forwarded to the corresponding thread of the fragment shader
out vec2 vTextureCoord;
out vec3 vLighting;

void main(void) {
	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);//Each vertex multiplied with ModelView and Projection matrices
	vColor = aVertexColor;
	vTextureCoord = aTextureCoord;

	//directional light fixed relative to the camera (view space), so it follows the orbit
	vec3 ambientLight = vec3(0.62, 0.6, 0.58);
	vec3 directionalLightColor = vec3(0.5, 0.46, 0.4);//warm key light (2013 value was a green 0.3, 1.0, 0.5)
	vec3 directionalVector = normalize(vec3(0.85, 0.8, 0.75));
	vec3 transformedNormal = normalize(uNormalMatrix * aVertexNormal);
	float directional = max(dot(transformedNormal, directionalVector), 0.0);
	vLighting = ambientLight + (directionalLightColor * directional);
}
