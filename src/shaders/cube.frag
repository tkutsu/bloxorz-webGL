#version 300 es
precision mediump float;
in vec4 vColor;//interpolated from the vertex shader
in vec2 vTextureCoord;
in vec3 vLighting;

//all tile textures in one array texture: one bind per frame, no bleeding between layers when mipmapped
uniform mediump sampler2DArray uTiles;
uniform int uLayer;

out vec4 fragColor;

void main(void) {
	vec4 texelColor = texture(uTiles, vec3(vTextureCoord, float(uLayer)))*vColor;
	fragColor = vec4(texelColor.rgb*vLighting, texelColor.a);//computing fragment color after lighting
}
