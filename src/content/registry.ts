import { Subject, SubjectId } from './types';
import type { Topic } from './types';
import { topicSchema, subjectMetaSchema } from './schema';

import subjectsMeta from './data/subjects.json';

// Biology topics
import bio_body_1_json from './data/topics/biology/bio-body-1.json';
import bio_cell_1_json from './data/topics/biology/bio-cell-1.json';
import bio_ecology_1_json from './data/topics/biology/bio-ecology-1.json';
import bio_genetics_1_json from './data/topics/biology/bio-genetics-1.json';
import bio_photosynthesis_1_json from './data/topics/biology/bio-photosynthesis-1.json';
import bio_reproduction_1_json from './data/topics/biology/bio-reproduction-1.json';
import bio_classification_1_json from './data/topics/biology/bio-classification-1.json';
import bio_respiration_1_json from './data/topics/biology/bio-respiration-1.json';
import bio_health_1_json from './data/topics/biology/bio-health-1.json';
import bio_plants_1_json from './data/topics/biology/bio-plants-1.json';
import bio_practical_1_json from './data/topics/biology/bio-practical-1.json';

// Chemistry topics
import chem_acids_1_json from './data/topics/chemistry/chem-acids-1.json';
import chem_atomic_1_json from './data/topics/chemistry/chem-atomic-1.json';
import chem_bonding_1_json from './data/topics/chemistry/chem-bonding-1.json';
import chem_changes_1_json from './data/topics/chemistry/chem-changes-1.json';
import chem_periodic_1_json from './data/topics/chemistry/chem-periodic-1.json';
import chem_states_1_json from './data/topics/chemistry/chem-states-1.json';
import chem_mixtures_1_json from './data/topics/chemistry/chem-mixtures-1.json';
import chem_metals_1_json from './data/topics/chemistry/chem-metals-1.json';
import chem_rates_1_json from './data/topics/chemistry/chem-rates-1.json';
import chem_earth_1_json from './data/topics/chemistry/chem-earth-1.json';

// English topics
import eng_essay_1_json from './data/topics/english/eng-essay-1.json';
import eng_figurative_1_json from './data/topics/english/eng-figurative-1.json';
import eng_narrative_1_json from './data/topics/english/eng-narrative-1.json';
import eng_poetry_1_json from './data/topics/english/eng-poetry-1.json';
import eng_reading_1_json from './data/topics/english/eng-reading-1.json';
import eng_grammar_1_json from './data/topics/english/eng-grammar-1.json';
import eng_persuasive_1_json from './data/topics/english/eng-persuasive-1.json';
import eng_nonfiction_1_json from './data/topics/english/eng-nonfiction-1.json';
import eng_creative_1_json from './data/topics/english/eng-creative-1.json';
import eng_speaking_1_json from './data/topics/english/eng-speaking-1.json';

// Math topics
import math_algebra_1_json from './data/topics/math/math-algebra-1.json';
import math_dp_binomial_json from './data/topics/math/math-dp-binomial.json';
import math_dp_complex_numbers_json from './data/topics/math/math-dp-complex-numbers.json';
import math_dp_correlation_regression_json from './data/topics/math/math-dp-correlation-regression.json';
import math_dp_descriptive_statistics_json from './data/topics/math/math-dp-descriptive-statistics.json';
import math_dp_differentiation_json from './data/topics/math/math-dp-differentiation.json';
import math_dp_explog_json from './data/topics/math/math-dp-explog.json';
import math_dp_exponents_json from './data/topics/math/math-dp-exponents.json';
import math_dp_functions_json from './data/topics/math/math-dp-functions.json';
import math_dp_graph_theory_json from './data/topics/math/math-dp-graph-theory.json';
import math_dp_hypothesis_testing_json from './data/topics/math/math-dp-hypothesis-testing.json';
import math_dp_integration_json from './data/topics/math/math-dp-integration.json';
import math_dp_kinematics_json from './data/topics/math/math-dp-kinematics.json';
import math_dp_matrices_json from './data/topics/math/math-dp-matrices.json';
import math_dp_poisson_distribution_json from './data/topics/math/math-dp-poisson-distribution.json';
import math_dp_probability_json from './data/topics/math/math-dp-probability.json';
import math_dp_quadratics_json from './data/topics/math/math-dp-quadratics.json';
import math_dp_sequences_json from './data/topics/math/math-dp-sequences.json';
import math_dp_trig_json from './data/topics/math/math-dp-trig.json';
import math_dp_vectors_json from './data/topics/math/math-dp-vectors.json';
import math_dp_voronoi_diagrams_json from './data/topics/math/math-dp-voronoi-diagrams.json';
import math_fractions_1_json from './data/topics/math/math-fractions-1.json';
import math_geometry_1_json from './data/topics/math/math-geometry-1.json';
import math_inequalities_myp_json from './data/topics/math/math-inequalities-myp.json';
import math_linear_myp_json from './data/topics/math/math-linear-myp.json';
import math_powers_myp_json from './data/topics/math/math-powers-myp.json';
import math_pythagoras_myp_json from './data/topics/math/math-pythagoras-myp.json';
import math_ratio_myp_json from './data/topics/math/math-ratio-myp.json';
import math_simultaneous_myp_json from './data/topics/math/math-simultaneous-myp.json';
import math_statistics_1_json from './data/topics/math/math-statistics-1.json';
import math_trig_basic_myp_json from './data/topics/math/math-trig-basic-myp.json';
import math_yr7_angles_json from './data/topics/math/math-yr7-angles.json';
import math_yr7_area_perimeter_json from './data/topics/math/math-yr7-area-perimeter.json';
import math_yr7_calculations_json from './data/topics/math/math-yr7-calculations.json';
import math_yr7_data_json from './data/topics/math/math-yr7-data.json';
import math_yr7_decimals_json from './data/topics/math/math-yr7-decimals.json';
import math_yr7_equations_json from './data/topics/math/math-yr7-equations.json';
import math_yr7_factors_multiples_json from './data/topics/math/math-yr7-factors-multiples.json';
import math_yr7_negative_numbers_json from './data/topics/math/math-yr7-negative-numbers.json';
import math_yr7_percentages_json from './data/topics/math/math-yr7-percentages.json';
import math_yr7_probability_json from './data/topics/math/math-yr7-probability.json';
import math_yr7_sequences_json from './data/topics/math/math-yr7-sequences.json';
import math_yr7_substitution_json from './data/topics/math/math-yr7-substitution.json';
import math_yr7_transformations_json from './data/topics/math/math-yr7-transformations.json';
import math_yr7_volume_surface_area_json from './data/topics/math/math-yr7-volume-surface-area.json';
import math_yr7_rounding_estimation_json from './data/topics/math/math-yr7-rounding-estimation.json';

// Physics topics
import phys_electricity_1_json from './data/topics/physics/phys-electricity-1.json';
import phys_energy_1_json from './data/topics/physics/phys-energy-1.json';
import phys_forces_1_json from './data/topics/physics/phys-forces-1.json';
import phys_magnetism_1_json from './data/topics/physics/phys-magnetism-1.json';
import phys_waves_1_json from './data/topics/physics/phys-waves-1.json';
import phys_space_1_json from './data/topics/physics/phys-space-1.json';
import phys_light_1_json from './data/topics/physics/phys-light-1.json';
import phys_pressure_1_json from './data/topics/physics/phys-pressure-1.json';
import phys_particles_1_json from './data/topics/physics/phys-particles-1.json';
import phys_radioactivity_1_json from './data/topics/physics/phys-radioactivity-1.json';

// Validate all imported topics
const bio_body_1: Topic = topicSchema.parse(bio_body_1_json);
const bio_cell_1: Topic = topicSchema.parse(bio_cell_1_json);
const bio_ecology_1: Topic = topicSchema.parse(bio_ecology_1_json);
const bio_genetics_1: Topic = topicSchema.parse(bio_genetics_1_json);
const bio_photosynthesis_1: Topic = topicSchema.parse(bio_photosynthesis_1_json);
const bio_reproduction_1: Topic = topicSchema.parse(bio_reproduction_1_json);
const bio_classification_1: Topic = topicSchema.parse(bio_classification_1_json);
const bio_respiration_1: Topic = topicSchema.parse(bio_respiration_1_json);
const bio_health_1: Topic = topicSchema.parse(bio_health_1_json);
const bio_plants_1: Topic = topicSchema.parse(bio_plants_1_json);
const bio_practical_1: Topic = topicSchema.parse(bio_practical_1_json);
const chem_acids_1: Topic = topicSchema.parse(chem_acids_1_json);
const chem_atomic_1: Topic = topicSchema.parse(chem_atomic_1_json);
const chem_bonding_1: Topic = topicSchema.parse(chem_bonding_1_json);
const chem_changes_1: Topic = topicSchema.parse(chem_changes_1_json);
const chem_periodic_1: Topic = topicSchema.parse(chem_periodic_1_json);
const chem_states_1: Topic = topicSchema.parse(chem_states_1_json);
const chem_mixtures_1: Topic = topicSchema.parse(chem_mixtures_1_json);
const chem_metals_1: Topic = topicSchema.parse(chem_metals_1_json);
const chem_rates_1: Topic = topicSchema.parse(chem_rates_1_json);
const chem_earth_1: Topic = topicSchema.parse(chem_earth_1_json);
const eng_essay_1: Topic = topicSchema.parse(eng_essay_1_json);
const eng_figurative_1: Topic = topicSchema.parse(eng_figurative_1_json);
const eng_narrative_1: Topic = topicSchema.parse(eng_narrative_1_json);
const eng_poetry_1: Topic = topicSchema.parse(eng_poetry_1_json);
const eng_reading_1: Topic = topicSchema.parse(eng_reading_1_json);
const eng_grammar_1: Topic = topicSchema.parse(eng_grammar_1_json);
const eng_persuasive_1: Topic = topicSchema.parse(eng_persuasive_1_json);
const eng_nonfiction_1: Topic = topicSchema.parse(eng_nonfiction_1_json);
const eng_creative_1: Topic = topicSchema.parse(eng_creative_1_json);
const eng_speaking_1: Topic = topicSchema.parse(eng_speaking_1_json);
const math_algebra_1: Topic = topicSchema.parse(math_algebra_1_json);
const math_dp_binomial: Topic = topicSchema.parse(math_dp_binomial_json);
const math_dp_complex_numbers: Topic = topicSchema.parse(math_dp_complex_numbers_json);
const math_dp_correlation_regression: Topic = topicSchema.parse(math_dp_correlation_regression_json);
const math_dp_descriptive_statistics: Topic = topicSchema.parse(math_dp_descriptive_statistics_json);
const math_dp_differentiation: Topic = topicSchema.parse(math_dp_differentiation_json);
const math_dp_explog: Topic = topicSchema.parse(math_dp_explog_json);
const math_dp_exponents: Topic = topicSchema.parse(math_dp_exponents_json);
const math_dp_functions: Topic = topicSchema.parse(math_dp_functions_json);
const math_dp_graph_theory: Topic = topicSchema.parse(math_dp_graph_theory_json);
const math_dp_hypothesis_testing: Topic = topicSchema.parse(math_dp_hypothesis_testing_json);
const math_dp_integration: Topic = topicSchema.parse(math_dp_integration_json);
const math_dp_kinematics: Topic = topicSchema.parse(math_dp_kinematics_json);
const math_dp_matrices: Topic = topicSchema.parse(math_dp_matrices_json);
const math_dp_poisson_distribution: Topic = topicSchema.parse(math_dp_poisson_distribution_json);
const math_dp_probability: Topic = topicSchema.parse(math_dp_probability_json);
const math_dp_quadratics: Topic = topicSchema.parse(math_dp_quadratics_json);
const math_dp_sequences: Topic = topicSchema.parse(math_dp_sequences_json);
const math_dp_trig: Topic = topicSchema.parse(math_dp_trig_json);
const math_dp_vectors: Topic = topicSchema.parse(math_dp_vectors_json);
const math_dp_voronoi_diagrams: Topic = topicSchema.parse(math_dp_voronoi_diagrams_json);
const math_fractions_1: Topic = topicSchema.parse(math_fractions_1_json);
const math_geometry_1: Topic = topicSchema.parse(math_geometry_1_json);
const math_inequalities_myp: Topic = topicSchema.parse(math_inequalities_myp_json);
const math_linear_myp: Topic = topicSchema.parse(math_linear_myp_json);
const math_powers_myp: Topic = topicSchema.parse(math_powers_myp_json);
const math_pythagoras_myp: Topic = topicSchema.parse(math_pythagoras_myp_json);
const math_ratio_myp: Topic = topicSchema.parse(math_ratio_myp_json);
const math_simultaneous_myp: Topic = topicSchema.parse(math_simultaneous_myp_json);
const math_statistics_1: Topic = topicSchema.parse(math_statistics_1_json);
const math_trig_basic_myp: Topic = topicSchema.parse(math_trig_basic_myp_json);
const math_yr7_angles: Topic = topicSchema.parse(math_yr7_angles_json);
const math_yr7_area_perimeter: Topic = topicSchema.parse(math_yr7_area_perimeter_json);
const math_yr7_calculations: Topic = topicSchema.parse(math_yr7_calculations_json);
const math_yr7_data: Topic = topicSchema.parse(math_yr7_data_json);
const math_yr7_decimals: Topic = topicSchema.parse(math_yr7_decimals_json);
const math_yr7_equations: Topic = topicSchema.parse(math_yr7_equations_json);
const math_yr7_factors_multiples: Topic = topicSchema.parse(math_yr7_factors_multiples_json);
const math_yr7_negative_numbers: Topic = topicSchema.parse(math_yr7_negative_numbers_json);
const math_yr7_percentages: Topic = topicSchema.parse(math_yr7_percentages_json);
const math_yr7_probability: Topic = topicSchema.parse(math_yr7_probability_json);
const math_yr7_sequences: Topic = topicSchema.parse(math_yr7_sequences_json);
const math_yr7_substitution: Topic = topicSchema.parse(math_yr7_substitution_json);
const math_yr7_transformations: Topic = topicSchema.parse(math_yr7_transformations_json);
const math_yr7_volume_surface_area: Topic = topicSchema.parse(math_yr7_volume_surface_area_json);
const math_yr7_rounding_estimation: Topic = topicSchema.parse(math_yr7_rounding_estimation_json);
const phys_electricity_1: Topic = topicSchema.parse(phys_electricity_1_json);
const phys_energy_1: Topic = topicSchema.parse(phys_energy_1_json);
const phys_forces_1: Topic = topicSchema.parse(phys_forces_1_json);
const phys_magnetism_1: Topic = topicSchema.parse(phys_magnetism_1_json);
const phys_waves_1: Topic = topicSchema.parse(phys_waves_1_json);
const phys_space_1: Topic = topicSchema.parse(phys_space_1_json);
const phys_light_1: Topic = topicSchema.parse(phys_light_1_json);
const phys_pressure_1: Topic = topicSchema.parse(phys_pressure_1_json);
const phys_particles_1: Topic = topicSchema.parse(phys_particles_1_json);
const phys_radioactivity_1: Topic = topicSchema.parse(phys_radioactivity_1_json);

const validatedSubjectsMeta = subjectMetaSchema.array().parse(subjectsMeta);

const biologyMeta = validatedSubjectsMeta.find((s) => s.id === 'biology')!;
const englishMeta = validatedSubjectsMeta.find((s) => s.id === 'english')!;
const chemistryMeta = validatedSubjectsMeta.find((s) => s.id === 'chemistry')!;
const physicsMeta = validatedSubjectsMeta.find((s) => s.id === 'physics')!;
const mathMeta = validatedSubjectsMeta.find((s) => s.id === 'math')!;

const biologySubject: Subject = {
  id: biologyMeta.id as SubjectId,
  name: biologyMeta.name,
  icon: biologyMeta.icon,
  accentColor: biologyMeta.accentColor,
  topics: [bio_body_1, bio_cell_1, bio_ecology_1, bio_genetics_1, bio_photosynthesis_1, bio_reproduction_1, bio_classification_1, bio_respiration_1, bio_health_1, bio_plants_1, bio_practical_1],
};

const englishSubject: Subject = {
  id: englishMeta.id as SubjectId,
  name: englishMeta.name,
  icon: englishMeta.icon,
  accentColor: englishMeta.accentColor,
  topics: [eng_essay_1, eng_figurative_1, eng_narrative_1, eng_poetry_1, eng_reading_1, eng_grammar_1, eng_persuasive_1, eng_nonfiction_1, eng_creative_1, eng_speaking_1],
};

const chemistrySubject: Subject = {
  id: chemistryMeta.id as SubjectId,
  name: chemistryMeta.name,
  icon: chemistryMeta.icon,
  accentColor: chemistryMeta.accentColor,
  topics: [chem_acids_1, chem_atomic_1, chem_bonding_1, chem_changes_1, chem_periodic_1, chem_states_1, chem_mixtures_1, chem_metals_1, chem_rates_1, chem_earth_1],
};

const physicsSubject: Subject = {
  id: physicsMeta.id as SubjectId,
  name: physicsMeta.name,
  icon: physicsMeta.icon,
  accentColor: physicsMeta.accentColor,
  topics: [phys_electricity_1, phys_energy_1, phys_forces_1, phys_magnetism_1, phys_waves_1, phys_space_1, phys_light_1, phys_pressure_1, phys_particles_1, phys_radioactivity_1],
};

const mathSubject: Subject = {
  id: mathMeta.id as SubjectId,
  name: mathMeta.name,
  icon: mathMeta.icon,
  accentColor: mathMeta.accentColor,
  topics: [math_algebra_1, math_dp_binomial, math_dp_complex_numbers, math_dp_correlation_regression, math_dp_descriptive_statistics, math_dp_differentiation, math_dp_explog, math_dp_exponents, math_dp_functions, math_dp_graph_theory, math_dp_hypothesis_testing, math_dp_integration, math_dp_kinematics, math_dp_matrices, math_dp_poisson_distribution, math_dp_probability, math_dp_quadratics, math_dp_sequences, math_dp_trig, math_dp_vectors, math_dp_voronoi_diagrams, math_fractions_1, math_geometry_1, math_inequalities_myp, math_linear_myp, math_powers_myp, math_pythagoras_myp, math_ratio_myp, math_simultaneous_myp, math_statistics_1, math_trig_basic_myp, math_yr7_angles, math_yr7_area_perimeter, math_yr7_calculations, math_yr7_data, math_yr7_decimals, math_yr7_equations, math_yr7_factors_multiples, math_yr7_negative_numbers, math_yr7_percentages, math_yr7_probability, math_yr7_rounding_estimation, math_yr7_sequences, math_yr7_substitution, math_yr7_transformations, math_yr7_volume_surface_area],
};

const subjects: Record<SubjectId, Subject> = {
  math: mathSubject,
  english: englishSubject,
  biology: biologySubject,
  chemistry: chemistrySubject,
  physics: physicsSubject,
};

export function getSubjects(): Subject[] {
  return Object.values(subjects);
}

export function getSubject(id: SubjectId): Subject | undefined {
  return subjects[id];
}

export function getTopic(subjectId: SubjectId, topicId: string) {
  return subjects[subjectId]?.topics.find((t) => t.id === topicId);
}

export const subjectMeta: Record<SubjectId, { name: string; icon: string; color: string }> = {
  math: { name: mathMeta.name, icon: mathMeta.icon, color: mathMeta.accentColor },
  english: { name: englishMeta.name, icon: englishMeta.icon, color: englishMeta.accentColor },
  biology: { name: biologyMeta.name, icon: biologyMeta.icon, color: biologyMeta.accentColor },
  chemistry: { name: chemistryMeta.name, icon: chemistryMeta.icon, color: chemistryMeta.accentColor },
  physics: { name: physicsMeta.name, icon: physicsMeta.icon, color: physicsMeta.accentColor },
};