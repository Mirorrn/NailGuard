export function createCooldownPlayer(src: string, cooldownMs: number) {
  const audio = new Audio(src);
  let armed = true;

  return {
    play() {
      if (!armed) return;
      armed = false;
      audio.currentTime = 0;
      void audio.play();
      window.setTimeout(() => {
        armed = true;
      }, cooldownMs);
    },
  };
}
