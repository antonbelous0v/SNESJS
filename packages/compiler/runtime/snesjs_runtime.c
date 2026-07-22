#include "snesjs_runtime.h"

static u32 sj_rng_state = 0x12345678;

void sj_init(void) {
    setMode(BG_MODE1, 0);
    setColor(0, RGB(0, 0, 12));
    oamInit(OBJ_SIZE8_L16, 0);
    setMainScreen(LAYER_OBJ);
    sj_assets_load();
    setScreenOn();
}

void sj_wait_vblank(void) {
    WaitForVBlank();
}

void sj_poll_input(void) {
}

void sj_flush_dma(void) {
}

void sj_oam_upload(void) {
}

void sj_sprite_create(u16 id, u16 tile, u16 palette, u16 x, u16 y) {
    oamSet(id, x, y, tile, palette, 1, 0);
    oamSetSize(id, OBJ_LARGE);
}

void sj_sprite_top(u16 id, u16 tile, u16 palette, u16 x, u16 y) {
    oamSet(id, x, y, tile, palette, 0, 0);
    oamSetSize(id, OBJ_LARGE);
}

void sj_sprite_create_small(u16 id, u16 tile, u16 palette, u16 x, u16 y) {
    oamSet(id, x, y, tile, palette, 0, 0);
    oamSetSize(id, OBJ_SMALL);
}

void sj_sprite_set_tile(u16 id, u16 tile) {
    oamSetTile(id, tile);
}

void sj_sprite_set_pos(u16 id, u16 x, u16 y) {
    oamSetXY(id, x, y);
}

void sj_sprite_hide(u16 id) {
    oamHide(id);
}

u16 sj_random(void) {
    sj_rng_state = sj_rng_state * 1664525 + 1013904223;
    return (u16)(sj_rng_state >> 16);
}

void sj_scene_change(const char* name) {
    (void)name;
}

void sj_audio_play_sfx(u8 bank, u8 index) {
    (void)bank;
    (void)index;
}

void sj_tilemap_scroll(u8 layer, u16 x, u16 y) {
    (void)layer;
    (void)x;
    (void)y;
}
