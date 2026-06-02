const BASE = 'https://hipkprgvvdowtwvomiqc.supabase.co/storage/v1/object/public/exercises';

export const videoUrl = (filename) => `${BASE}/${filename}.webm`;

// Program egzersizleri — ProgramScreen'deki fallback url haritası
export const MEDIA_URLS = {
  'Plate Loaded Chest Press':        videoUrl('chest-press-machine'),
  'Smith Machine Low Incline Press': videoUrl('smith-machine-incline-bench-press'),
  'Chest Fly Machine':               videoUrl('pec-deck-fly-machine'),
  'Shoulder Press Machine':          videoUrl('shoulder-press-machine'),
  'Lateral Raise':                   videoUrl('dumbbell-lateral-raise'),
  'Triceps Pushdown':                videoUrl('cable-push-down'),
  'Overhead Rope Extension':         videoUrl('cable-overhead-tricep-extension'),
  'Cable Crunch':                    videoUrl('crunch'),
  '*Finisher: Cable Crunch':         videoUrl('crunch'),
  'Lat Pulldown':                    videoUrl('lat-pull-down'),
  'Plate Loaded Wide Grip Row':      videoUrl('high-row-machine'),
  'Cable Row':                       videoUrl('seated-cable-row'),
  'Incline Dumbbell Curl':           videoUrl('incline-dumbbell-curl'),
  'Cable Curl':                      videoUrl('cable-curl'),
  'Hammer Curl':                     videoUrl('dumbbell-hammer-curl'),
  'Leg Press':                       videoUrl('leg-press'),
  'Smith Machine Squat':             videoUrl('smith-machine-squat'),
  'Leg Extension':                   videoUrl('leg-extension'),
  'Seated Leg Curl':                 videoUrl('seated-leg-curl'),
  'Wrist Curl':                      videoUrl('barbell-wrist-curl'),
  'Reverse Wrist Curl':              videoUrl('reverse-barbell-wrist-curl'),
  'Romanian Deadlift':               videoUrl('romanian-deadlift'),
  'Cable Rear Delt Fly':             videoUrl('cable-reverse-fly'),
};
