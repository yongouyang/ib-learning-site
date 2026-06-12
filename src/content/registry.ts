import { Subject, SubjectId } from './types';
import type { Topic } from './types';

import subjectsMeta from './data/subjects.json';

// Biology topics
import bio_body_1_json from './data/topics/biology/bio-body-1.json';
import bio_cell_1_json from './data/topics/biology/bio-cell-1.json';
import bio_ecology_1_json from './data/topics/biology/bio-ecology-1.json';
import bio_genetics_1_json from './data/topics/biology/bio-genetics-1.json';
import bio_photosynthesis_1_json from './data/topics/biology/bio-photosynthesis-1.json';

// Chemistry topics
import chem_acids_1_json from './data/topics/chemistry/chem-acids-1.json';
import chem_atomic_1_json from './data/topics/chemistry/chem-atomic-1.json';
import chem_bonding_1_json from './data/topics/chemistry/chem-bonding-1.json';
import chem_changes_1_json from './data/topics/chemistry/chem-changes-1.json';
import chem_periodic_1_json from './data/topics/chemistry/chem-periodic-1.json';

// English topics
import eng_essay_1_json from './data/topics/english/eng-essay-1.json';
import eng_figurative_1_json from './data/topics/english/eng-figurative-1.json';
import eng_narrative_1_json from './data/topics/english/eng-narrative-1.json';
import eng_poetry_1_json from './data/topics/english/eng-poetry-1.json';
import eng_reading_1_json from './data/topics/english/eng-reading-1.json';

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
import math_fractions_1_json from './data/topics/math/math-fractions-1.json';
import math_geometry_1_json from './data/topics/math/math-geometry-1.json';
import math_inequalities_myp_json from './data/topics/math/math-inequalities-myp.json';
import math_linear_myp_json from './data/topics/math/math-linear-myp.json';
import math_patterns_1_json from './data/topics/math/math-patterns-1.json';
import math_powers_myp_json from './data/topics/math/math-powers-myp.json';
import math_pythagoras_myp_json from './data/topics/math/math-pythagoras-myp.json';
import math_ratio_myp_json from './data/topics/math/math-ratio-myp.json';
import math_simultaneous_myp_json from './data/topics/math/math-simultaneous-myp.json';
import math_statistics_1_json from './data/topics/math/math-statistics-1.json';
import math_trig_basic_myp_json from './data/topics/math/math-trig-basic-myp.json';
import math_yr7_calculations_json from './data/topics/math/math-yr7-calculations.json';
import math_yr7_data_json from './data/topics/math/math-yr7-data.json';
import math_yr7_decimals_json from './data/topics/math/math-yr7-decimals.json';
import math_yr7_equations_json from './data/topics/math/math-yr7-equations.json';
import math_yr7_probability_json from './data/topics/math/math-yr7-probability.json';
import math_yr7_substitution_json from './data/topics/math/math-yr7-substitution.json';
import math_yr7_transformations_json from './data/topics/math/math-yr7-transformations.json';

// Physics topics
import phys_electricity_1_json from './data/topics/physics/phys-electricity-1.json';
import phys_energy_1_json from './data/topics/physics/phys-energy-1.json';
import phys_forces_1_json from './data/topics/physics/phys-forces-1.json';
import phys_magnetism_1_json from './data/topics/physics/phys-magnetism-1.json';
import phys_waves_1_json from './data/topics/physics/phys-waves-1.json';

// Cast all imported JSON to Topic type
const bio_body_1: Topic = bio_body_1_json as Topic;
const bio_cell_1: Topic = bio_cell_1_json as Topic;
const bio_ecology_1: Topic = bio_ecology_1_json as Topic;
const bio_genetics_1: Topic = bio_genetics_1_json as Topic;
const bio_photosynthesis_1: Topic = bio_photosynthesis_1_json as Topic;
const chem_acids_1: Topic = chem_acids_1_json as Topic;
const chem_atomic_1: Topic = chem_atomic_1_json as Topic;
const chem_bonding_1: Topic = chem_bonding_1_json as Topic;
const chem_changes_1: Topic = chem_changes_1_json as Topic;
const chem_periodic_1: Topic = chem_periodic_1_json as Topic;
const eng_essay_1: Topic = eng_essay_1_json as Topic;
const eng_figurative_1: Topic = eng_figurative_1_json as Topic;
const eng_narrative_1: Topic = eng_narrative_1_json as Topic;
const eng_poetry_1: Topic = eng_poetry_1_json as Topic;
const eng_reading_1: Topic = eng_reading_1_json as Topic;
const math_algebra_1: Topic = math_algebra_1_json as Topic;
const math_dp_binomial: Topic = math_dp_binomial_json as Topic;
const math_dp_complex_numbers: Topic = math_dp_complex_numbers_json as Topic;
const math_dp_correlation_regression: Topic = math_dp_correlation_regression_json as Topic;
const math_dp_descriptive_statistics: Topic = math_dp_descriptive_statistics_json as Topic;
const math_dp_differentiation: Topic = math_dp_differentiation_json as Topic;
const math_dp_explog: Topic = math_dp_explog_json as Topic;
const math_dp_exponents: Topic = math_dp_exponents_json as Topic;
const math_dp_functions: Topic = math_dp_functions_json as Topic;
const math_dp_hypothesis_testing: Topic = math_dp_hypothesis_testing_json as Topic;
const math_dp_integration: Topic = math_dp_integration_json as Topic;
const math_dp_kinematics: Topic = math_dp_kinematics_json as Topic;
const math_dp_matrices: Topic = math_dp_matrices_json as Topic;
const math_dp_poisson_distribution: Topic = math_dp_poisson_distribution_json as Topic;
const math_dp_probability: Topic = math_dp_probability_json as Topic;
const math_dp_quadratics: Topic = math_dp_quadratics_json as Topic;
const math_dp_sequences: Topic = math_dp_sequences_json as Topic;
const math_dp_trig: Topic = math_dp_trig_json as Topic;
const math_dp_vectors: Topic = math_dp_vectors_json as Topic;
const math_fractions_1: Topic = math_fractions_1_json as Topic;
const math_geometry_1: Topic = math_geometry_1_json as Topic;
const math_inequalities_myp: Topic = math_inequalities_myp_json as Topic;
const math_linear_myp: Topic = math_linear_myp_json as Topic;
const math_patterns_1: Topic = math_patterns_1_json as Topic;
const math_powers_myp: Topic = math_powers_myp_json as Topic;
const math_pythagoras_myp: Topic = math_pythagoras_myp_json as Topic;
const math_ratio_myp: Topic = math_ratio_myp_json as Topic;
const math_simultaneous_myp: Topic = math_simultaneous_myp_json as Topic;
const math_statistics_1: Topic = math_statistics_1_json as Topic;
const math_trig_basic_myp: Topic = math_trig_basic_myp_json as Topic;
const math_yr7_calculations: Topic = math_yr7_calculations_json as Topic;
const math_yr7_data: Topic = math_yr7_data_json as Topic;
const math_yr7_decimals: Topic = math_yr7_decimals_json as Topic;
const math_yr7_equations: Topic = math_yr7_equations_json as Topic;
const math_yr7_probability: Topic = math_yr7_probability_json as Topic;
const math_yr7_substitution: Topic = math_yr7_substitution_json as Topic;
const math_yr7_transformations: Topic = math_yr7_transformations_json as Topic;
const phys_electricity_1: Topic = phys_electricity_1_json as Topic;
const phys_energy_1: Topic = phys_energy_1_json as Topic;
const phys_forces_1: Topic = phys_forces_1_json as Topic;
const phys_magnetism_1: Topic = phys_magnetism_1_json as Topic;
const phys_waves_1: Topic = phys_waves_1_json as Topic;

const biologyMeta = subjectsMeta.find((s) => s.id === 'biology')!;
const englishMeta = subjectsMeta.find((s) => s.id === 'english')!;
const chemistryMeta = subjectsMeta.find((s) => s.id === 'chemistry')!;
const physicsMeta = subjectsMeta.find((s) => s.id === 'physics')!;
const mathMeta = subjectsMeta.find((s) => s.id === 'math')!;

const biologySubject: Subject = {
  id: biologyMeta.id as SubjectId,
  name: biologyMeta.name,
  icon: biologyMeta.icon,
  accentColor: biologyMeta.accentColor,
  topics: [bio_body_1, bio_cell_1, bio_ecology_1, bio_genetics_1, bio_photosynthesis_1],
};

const englishSubject: Subject = {
  id: englishMeta.id as SubjectId,
  name: englishMeta.name,
  icon: englishMeta.icon,
  accentColor: englishMeta.accentColor,
  topics: [eng_essay_1, eng_figurative_1, eng_narrative_1, eng_poetry_1, eng_reading_1],
};

const chemistrySubject: Subject = {
  id: chemistryMeta.id as SubjectId,
  name: chemistryMeta.name,
  icon: chemistryMeta.icon,
  accentColor: chemistryMeta.accentColor,
  topics: [chem_acids_1, chem_atomic_1, chem_bonding_1, chem_changes_1, chem_periodic_1],
};

const physicsSubject: Subject = {
  id: physicsMeta.id as SubjectId,
  name: physicsMeta.name,
  icon: physicsMeta.icon,
  accentColor: physicsMeta.accentColor,
  topics: [phys_electricity_1, phys_energy_1, phys_forces_1, phys_magnetism_1, phys_waves_1],
};

const mathSubject: Subject = {
  id: mathMeta.id as SubjectId,
  name: mathMeta.name,
  icon: mathMeta.icon,
  accentColor: mathMeta.accentColor,
  topics: [math_algebra_1, math_dp_binomial, math_dp_complex_numbers, math_dp_correlation_regression, math_dp_descriptive_statistics, math_dp_differentiation, math_dp_explog, math_dp_exponents, math_dp_functions, math_dp_hypothesis_testing, math_dp_integration, math_dp_kinematics, math_dp_matrices, math_dp_poisson_distribution, math_dp_probability, math_dp_quadratics, math_dp_sequences, math_dp_trig, math_dp_vectors, math_fractions_1, math_geometry_1, math_inequalities_myp, math_linear_myp, math_patterns_1, math_powers_myp, math_pythagoras_myp, math_ratio_myp, math_simultaneous_myp, math_statistics_1, math_trig_basic_myp, math_yr7_calculations, math_yr7_data, math_yr7_decimals, math_yr7_equations, math_yr7_probability, math_yr7_substitution, math_yr7_transformations],
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