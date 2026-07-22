#include "snesjs_runtime.h"

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
    oamSet(id, x, y, tile, palette, 3, 0);
    oamSetSize(id, OBJ_LARGE);
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
