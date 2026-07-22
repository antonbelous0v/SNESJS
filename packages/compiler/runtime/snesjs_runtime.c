#include "snesjs_runtime.h"

static const u8 snesjs_sprite_tile[32] = {
    0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00,
    0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
};

static const u8 snesjs_sprite_palette[32] = {
    0x00, 0x00, 0xFF, 0x7F, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
};

void sj_init(void) {
    consoleInit();
    setMode(BG_MODE1, 0);
    setColor(0, RGB(0, 0, 12));
    dmaCopyVram(snesjs_sprite_tile, 0x0000, 32);
    dmaCopyCGram(snesjs_sprite_palette, OBJ_CGRAM_BASE, 32);
    oamInit(OBJ_SIZE8_L16, 0);
    setMainScreen(LAYER_BG1 | LAYER_OBJ);
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

void sj_sprite_create(u16 id, u16 x, u16 y) {
    oamSet(id, x, y, 0, 0, 3, 0);
    oamSetSize(id, OBJ_SMALL);
}

void sj_sprite_set_pos(u16 id, u16 x, u16 y) {
    oamSetXY(id, x, y);
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
