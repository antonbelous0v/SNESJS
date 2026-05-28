#ifndef SNESJS_RUNTIME_H
#define SNESJS_RUNTIME_H

#define SNESJS_RUNTIME_ABI 1

typedef unsigned char u8;
typedef signed char i8;
typedef unsigned short u16;
typedef short i16;
typedef unsigned long u24;
typedef unsigned long u32;
typedef long i32;

void sj_init(void);
void sj_wait_vblank(void);
void sj_poll_input(void);
void sj_flush_dma(void);
void sj_oam_upload(void);

void sj_sprite_create(u16 id, u16 x, u16 y);
void sj_sprite_set_pos(u16 id, u16 x, u16 y);
void sj_scene_change(const char* name);
void sj_audio_play_sfx(u8 bank, u8 index);
void sj_tilemap_scroll(u8 layer, u16 x, u16 y);

#endif
