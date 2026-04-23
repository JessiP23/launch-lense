export const LANDING_EASE = [0.16, 1, 0.3, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: LANDING_EASE },
  },
};

export const staggerShow = (delay = 0.07) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
});

export const fadeUpItem = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: LANDING_EASE },
  },
};
