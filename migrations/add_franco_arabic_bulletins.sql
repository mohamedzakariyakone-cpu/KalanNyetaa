-- ============================================================================
-- Migration : Support des Bulletins Franco-Arabes (Sections FR / AR)
-- À exécuter dans l'éditeur SQL de Supabase
-- ============================================================================

-- 1. Ajouter la langue de la matière sur class_subjects ('fr' par défaut, ou 'ar')
-- Remarque : toute matière créée depuis l'application enregistre directement
-- 'fr' ou 'ar' selon la section choisie, même si son nom est écrit en alphabet latin.
ALTER TABLE class_subjects
ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'fr';

-- Contrainte pour garantir uniquement 'fr' ou 'ar'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'class_subjects_language_check'
  ) THEN
    ALTER TABLE class_subjects
    ADD CONSTRAINT class_subjects_language_check
    CHECK (language IN ('fr', 'ar'));
  END IF;
END $$;

-- 2. (Optionnel) Rattrapage des anciennes matières déjà en base avant cette migration :
--    - celles écrites en caractères arabes (Unicode U+0600..U+06FF)
--    - celles portant un intitulé arabe courant écrit en alphabet français
--    (Ne touche jamais aux matières déjà classées en 'ar'.)
UPDATE class_subjects
SET language = 'ar'
WHERE language = 'fr'
  AND (
    subject_name ~ E'[\u0600-\u06FF]'
    OR subject_name ~* '(^|[^[:alpha:]])(arabe|coran|qur''?an|fiqh|fikh|hadith|hadis|tawhid|taouhid|tajwid|tajweed|sira|sirah|nahw|sarf|incha|qiraa|tarbiya|islamique|islami)([^[:alpha:]]|$)'
  );

-- 3. Ajouter les options de mode bulletin sur la table schools (si présente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'schools'
  ) THEN
    ALTER TABLE schools
    ADD COLUMN IF NOT EXISTS bulletin_mode VARCHAR(20) NOT NULL DEFAULT 'classic';

    ALTER TABLE schools
    ADD COLUMN IF NOT EXISTS franco_arabic_combined BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- Index utile pour filtrer rapidement par classe + langue
CREATE INDEX IF NOT EXISTS idx_class_subjects_class_language
ON class_subjects (class_id, language);
