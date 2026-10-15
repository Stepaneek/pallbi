ALTER TABLE public.training_blocks ADD COLUMN shooting_intensity text;
ALTER TABLE public.training_blocks ADD CONSTRAINT training_blocks_shooting_intensity_check
  CHECK (shooting_intensity IS NULL OR shooting_intensity IN ('klidova','i1','i2','i3','i4','i5','pripravna')) NOT VALID;