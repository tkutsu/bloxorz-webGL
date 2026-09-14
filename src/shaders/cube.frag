#version 300 es
precision mediump float;
in vec4 vColor;//interpolated from the vertex shader
in vec2 vTextureCoord;
//in vec3 vLighting;

uniform sampler2D uSampler;

out vec4 fragColor;

void main(void) {
	fragColor = texture(uSampler, vTextureCoord)*vColor;
	//vec4 texelColor = texture(uSampler, vTextureCoord)*vColor;
	//fragColor = vec4(texelColor.rgb*vLighting, texelColor.a);//computing fragment color after lighting
}
