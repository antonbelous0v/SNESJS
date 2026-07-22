#ifndef SNESJS_RUNTIME_H
#define SNESJS_RUNTIME_H

#define SNESJS_RUNTIME_ABI 2

#include <snes.h>

void sj_init(void);
void sj_assets_load(void);
void sj_wait_vblank(void);
void sj_poll_input(void);
void sj_flush_dma(void);
void sj_oam_upload(void);
void sj_sprite_create(u16 id, u16 tile, u16 palette, u16 x, u16 y);
void sj_sprite_set_tile(u16 id, u16 tile);
void sj_sprite_set_pos(u16 id, u16 x, u16 y);
void sj_sprite_hide(u16 id);
void sj_scene_change(const char* name);
void sj_audio_play_sfx(u8 bank, u8 index);
void sj_tilemap_scroll(u8 layer, u16 x, u16 y);

#endif
