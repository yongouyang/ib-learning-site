import { Subject, SubjectId } from './types';
import type { Topic, Paper } from './types';
import { topicSchema, subjectMetaSchema, paperSchema } from './schema';

import subjectsMeta from './data/subjects.json';

// Math topics
import math_algebra_1_json from './data/topics/math/math-algebra-1.json';
import math_dp_ai_binomial_json from './data/topics/math/math-dp-ai-binomial.json';
import math_dp_ai_complex_numbers_json from './data/topics/math/math-dp-ai-complex-numbers.json';
import math_dp_ai_correlation_regression_json from './data/topics/math/math-dp-ai-correlation-regression.json';
import math_dp_ai_descriptive_statistics_json from './data/topics/math/math-dp-ai-descriptive-statistics.json';
import math_dp_ai_differentiation_json from './data/topics/math/math-dp-ai-differentiation.json';
import math_dp_ai_explog_json from './data/topics/math/math-dp-ai-explog.json';
import math_dp_ai_exponents_json from './data/topics/math/math-dp-ai-exponents.json';
import math_dp_ai_functions_json from './data/topics/math/math-dp-ai-functions.json';
import math_dp_ai_graph_theory_json from './data/topics/math/math-dp-ai-graph-theory.json';
import math_dp_ai_hypothesis_testing_json from './data/topics/math/math-dp-ai-hypothesis-testing.json';
import math_dp_ai_integration_json from './data/topics/math/math-dp-ai-integration.json';
import math_dp_ai_kinematics_json from './data/topics/math/math-dp-ai-kinematics.json';
import math_dp_ai_matrices_json from './data/topics/math/math-dp-ai-matrices.json';
import math_dp_ai_poisson_distribution_json from './data/topics/math/math-dp-ai-poisson-distribution.json';
import math_dp_ai_probability_json from './data/topics/math/math-dp-ai-probability.json';
import math_dp_ai_quadratics_json from './data/topics/math/math-dp-ai-quadratics.json';
import math_dp_ai_sequences_json from './data/topics/math/math-dp-ai-sequences.json';
import math_dp_ai_trig_json from './data/topics/math/math-dp-ai-trig.json';
import math_dp_ai_vectors_json from './data/topics/math/math-dp-ai-vectors.json';
import math_dp_ai_voronoi_diagrams_json from './data/topics/math/math-dp-ai-voronoi-diagrams.json';
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
import math_yr7_algebraic_expressions_json from './data/topics/math/math-yr7-algebraic-expressions.json';
import math_yr7_angles_json from './data/topics/math/math-yr7-angles.json';
import math_yr7_area_perimeter_json from './data/topics/math/math-yr7-area-perimeter.json';
import math_yr7_bearings_scale_json from './data/topics/math/math-yr7-bearings-scale.json';
import math_yr7_calculations_json from './data/topics/math/math-yr7-calculations.json';
import math_yr7_constructions_loci_json from './data/topics/math/math-yr7-constructions-loci.json';
import math_yr7_data_json from './data/topics/math/math-yr7-data.json';
import math_yr7_decimals_json from './data/topics/math/math-yr7-decimals.json';
import math_yr7_equations_json from './data/topics/math/math-yr7-equations.json';
import math_yr7_factors_multiples_json from './data/topics/math/math-yr7-factors-multiples.json';
import math_yr7_measures_conversions_json from './data/topics/math/math-yr7-measures-conversions.json';
import math_yr7_money_finance_json from './data/topics/math/math-yr7-money-finance.json';
import math_yr7_negative_numbers_json from './data/topics/math/math-yr7-negative-numbers.json';
import math_yr7_nets_3d_shapes_json from './data/topics/math/math-yr7-nets-3d-shapes.json';
import math_yr7_percentages_json from './data/topics/math/math-yr7-percentages.json';
import math_yr7_probability_json from './data/topics/math/math-yr7-probability.json';
import math_yr7_rounding_estimation_json from './data/topics/math/math-yr7-rounding-estimation.json';
import math_yr7_sequences_json from './data/topics/math/math-yr7-sequences.json';
import math_yr7_substitution_json from './data/topics/math/math-yr7-substitution.json';
import math_yr7_transformations_json from './data/topics/math/math-yr7-transformations.json';
import math_yr7_venn_sets_json from './data/topics/math/math-yr7-venn-sets.json';
import math_yr7_volume_surface_area_json from './data/topics/math/math-yr7-volume-surface-area.json';
import math_yr8_angles_parallel_polygons_json from './data/topics/math/math-yr8-angles-parallel-polygons.json';
import math_yr8_circles_json from './data/topics/math/math-yr8-circles.json';
import math_yr8_compound_measures_json from './data/topics/math/math-yr8-compound-measures.json';
import math_yr8_congruence_similarity_json from './data/topics/math/math-yr8-congruence-similarity.json';
import math_yr8_factorising_json from './data/topics/math/math-yr8-factorising.json';
import math_yr8_linear_equations_json from './data/topics/math/math-yr8-linear-equations.json';
import math_yr8_percentages_ratio_proportion_json from './data/topics/math/math-yr8-percentages-ratio-proportion.json';
import math_yr8_probability_trees_json from './data/topics/math/math-yr8-probability-trees.json';
import math_yr8_pythagoras_json from './data/topics/math/math-yr8-pythagoras.json';
import math_yr8_sequences_json from './data/topics/math/math-yr8-sequences.json';
import math_yr8_standard_form_json from './data/topics/math/math-yr8-standard-form.json';
import math_yr8_statistics_averages_json from './data/topics/math/math-yr8-statistics-averages.json';
import math_yr8_straight_line_graphs_json from './data/topics/math/math-yr8-straight-line-graphs.json';
import math_yr8_transformations_json from './data/topics/math/math-yr8-transformations.json';
import math_yr8_volume_surface_area_json from './data/topics/math/math-yr8-volume-surface-area.json';
import math_yr9_3d_geometry_json from './data/topics/math/math-yr9-3d-geometry.json';
import math_yr9_error_intervals_json from './data/topics/math/math-yr9-error-intervals.json';
import math_yr9_quadratic_expressions_json from './data/topics/math/math-yr9-quadratic-expressions.json';
import math_yr9_quadratic_graphs_json from './data/topics/math/math-yr9-quadratic-graphs.json';
import math_yr9_standard_form_json from './data/topics/math/math-yr9-standard-form.json';
import math_yr9_surds_json from './data/topics/math/math-yr9-surds.json';
// English topics
import eng_creative_1_json from './data/topics/english/eng-creative-1.json';
import eng_drama_shakespeare_json from './data/topics/english/eng-drama-shakespeare.json';
import eng_essay_1_json from './data/topics/english/eng-essay-1.json';
import eng_figurative_1_json from './data/topics/english/eng-figurative-1.json';
import eng_grammar_1_json from './data/topics/english/eng-grammar-1.json';
import eng_media_visual_literacy_json from './data/topics/english/eng-media-visual-literacy.json';
import eng_myths_legends_json from './data/topics/english/eng-myths-legends.json';
import eng_narrative_1_json from './data/topics/english/eng-narrative-1.json';
import eng_nonfiction_1_json from './data/topics/english/eng-nonfiction-1.json';
import eng_novel_study_1_json from './data/topics/english/eng-novel-study-1.json';
import eng_persuasive_1_json from './data/topics/english/eng-persuasive-1.json';
import eng_persuasive_speaking_1_json from './data/topics/english/eng-persuasive-speaking-1.json';
import eng_poetry_1_json from './data/topics/english/eng-poetry-1.json';
import eng_poetry_writing_1_json from './data/topics/english/eng-poetry-writing-1.json';
import eng_reading_1_json from './data/topics/english/eng-reading-1.json';
import eng_speaking_1_json from './data/topics/english/eng-speaking-1.json';
import eng_spelling_1_json from './data/topics/english/eng-spelling-1.json';
// Biology topics
import bio_body_1_json from './data/topics/biology/bio-body-1.json';
import bio_cell_1_json from './data/topics/biology/bio-cell-1.json';
import bio_classification_1_json from './data/topics/biology/bio-classification-1.json';
import bio_ecology_1_json from './data/topics/biology/bio-ecology-1.json';
import bio_genetics_1_json from './data/topics/biology/bio-genetics-1.json';
import bio_health_1_json from './data/topics/biology/bio-health-1.json';
import bio_human_reproduction_1_json from './data/topics/biology/bio-human-reproduction-1.json';
import bio_microorganisms_1_json from './data/topics/biology/bio-microorganisms-1.json';
import bio_photosynthesis_1_json from './data/topics/biology/bio-photosynthesis-1.json';
import bio_plants_1_json from './data/topics/biology/bio-plants-1.json';
import bio_practical_1_json from './data/topics/biology/bio-practical-1.json';
import bio_reproduction_1_json from './data/topics/biology/bio-reproduction-1.json';
import bio_respiration_1_json from './data/topics/biology/bio-respiration-1.json';
// Chemistry topics
import chem_acids_1_json from './data/topics/chemistry/chem-acids-1.json';
import chem_atomic_1_json from './data/topics/chemistry/chem-atomic-1.json';
import chem_bonding_1_json from './data/topics/chemistry/chem-bonding-1.json';
import chem_changes_1_json from './data/topics/chemistry/chem-changes-1.json';
import chem_earth_1_json from './data/topics/chemistry/chem-earth-1.json';
import chem_metals_1_json from './data/topics/chemistry/chem-metals-1.json';
import chem_mixtures_1_json from './data/topics/chemistry/chem-mixtures-1.json';
import chem_organic_1_json from './data/topics/chemistry/chem-organic-1.json';
import chem_periodic_1_json from './data/topics/chemistry/chem-periodic-1.json';
import chem_rates_1_json from './data/topics/chemistry/chem-rates-1.json';
import chem_states_1_json from './data/topics/chemistry/chem-states-1.json';
import chem_working_scientifically_1_json from './data/topics/chemistry/chem-working-scientifically-1.json';
// Physics topics
import phys_electricity_1_json from './data/topics/physics/phys-electricity-1.json';
import phys_energy_1_json from './data/topics/physics/phys-energy-1.json';
import phys_energy_resources_1_json from './data/topics/physics/phys-energy-resources-1.json';
import phys_forces_1_json from './data/topics/physics/phys-forces-1.json';
import phys_forces_action_1_json from './data/topics/physics/phys-forces-action-1.json';
import phys_light_1_json from './data/topics/physics/phys-light-1.json';
import phys_magnetism_1_json from './data/topics/physics/phys-magnetism-1.json';
import phys_particles_1_json from './data/topics/physics/phys-particles-1.json';
import phys_pressure_1_json from './data/topics/physics/phys-pressure-1.json';
import phys_radioactivity_1_json from './data/topics/physics/phys-radioactivity-1.json';
import phys_space_1_json from './data/topics/physics/phys-space-1.json';
import phys_waves_1_json from './data/topics/physics/phys-waves-1.json';
import phys_working_scientifically_1_json from './data/topics/physics/phys-working-scientifically-1.json';

// bio-ks3 practice sets
import bio_ks3_bio_ks3_set_1_json from './data/papers/bio-ks3/bio-ks3-set-1.json';
// chem-ks3 practice sets
import chem_ks3_chem_ks3_set_1_json from './data/papers/chem-ks3/chem-ks3-set-1.json';
// eng-ks3 practice sets
import eng_ks3_eng_ks3_set_1_json from './data/papers/eng-ks3/eng-ks3-set-1.json';
// math-dp-ai practice sets
import math_dp_ai_math_dp_ai_set_1_json from './data/papers/math-dp-ai/math-dp-ai-set-1.json';
// math-y7 practice sets
import math_y7_math_y7_set_1_json from './data/papers/math-y7/math-y7-set-1.json';
// math-y8 practice sets
import math_y8_math_y8_set_1_json from './data/papers/math-y8/math-y8-set-1.json';
// math-y9 practice sets
import math_y9_math_y9_set_1_json from './data/papers/math-y9/math-y9-set-1.json';
// phys-ks3 practice sets
import phys_ks3_phys_ks3_set_1_json from './data/papers/phys-ks3/phys-ks3-set-1.json';

const math_algebra_1: Topic = topicSchema.parse(math_algebra_1_json);
const math_dp_ai_binomial: Topic = topicSchema.parse(math_dp_ai_binomial_json);
const math_dp_ai_complex_numbers: Topic = topicSchema.parse(math_dp_ai_complex_numbers_json);
const math_dp_ai_correlation_regression: Topic = topicSchema.parse(math_dp_ai_correlation_regression_json);
const math_dp_ai_descriptive_statistics: Topic = topicSchema.parse(math_dp_ai_descriptive_statistics_json);
const math_dp_ai_differentiation: Topic = topicSchema.parse(math_dp_ai_differentiation_json);
const math_dp_ai_explog: Topic = topicSchema.parse(math_dp_ai_explog_json);
const math_dp_ai_exponents: Topic = topicSchema.parse(math_dp_ai_exponents_json);
const math_dp_ai_functions: Topic = topicSchema.parse(math_dp_ai_functions_json);
const math_dp_ai_graph_theory: Topic = topicSchema.parse(math_dp_ai_graph_theory_json);
const math_dp_ai_hypothesis_testing: Topic = topicSchema.parse(math_dp_ai_hypothesis_testing_json);
const math_dp_ai_integration: Topic = topicSchema.parse(math_dp_ai_integration_json);
const math_dp_ai_kinematics: Topic = topicSchema.parse(math_dp_ai_kinematics_json);
const math_dp_ai_matrices: Topic = topicSchema.parse(math_dp_ai_matrices_json);
const math_dp_ai_poisson_distribution: Topic = topicSchema.parse(math_dp_ai_poisson_distribution_json);
const math_dp_ai_probability: Topic = topicSchema.parse(math_dp_ai_probability_json);
const math_dp_ai_quadratics: Topic = topicSchema.parse(math_dp_ai_quadratics_json);
const math_dp_ai_sequences: Topic = topicSchema.parse(math_dp_ai_sequences_json);
const math_dp_ai_trig: Topic = topicSchema.parse(math_dp_ai_trig_json);
const math_dp_ai_vectors: Topic = topicSchema.parse(math_dp_ai_vectors_json);
const math_dp_ai_voronoi_diagrams: Topic = topicSchema.parse(math_dp_ai_voronoi_diagrams_json);
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
const math_yr7_algebraic_expressions: Topic = topicSchema.parse(math_yr7_algebraic_expressions_json);
const math_yr7_angles: Topic = topicSchema.parse(math_yr7_angles_json);
const math_yr7_area_perimeter: Topic = topicSchema.parse(math_yr7_area_perimeter_json);
const math_yr7_bearings_scale: Topic = topicSchema.parse(math_yr7_bearings_scale_json);
const math_yr7_calculations: Topic = topicSchema.parse(math_yr7_calculations_json);
const math_yr7_constructions_loci: Topic = topicSchema.parse(math_yr7_constructions_loci_json);
const math_yr7_data: Topic = topicSchema.parse(math_yr7_data_json);
const math_yr7_decimals: Topic = topicSchema.parse(math_yr7_decimals_json);
const math_yr7_equations: Topic = topicSchema.parse(math_yr7_equations_json);
const math_yr7_factors_multiples: Topic = topicSchema.parse(math_yr7_factors_multiples_json);
const math_yr7_measures_conversions: Topic = topicSchema.parse(math_yr7_measures_conversions_json);
const math_yr7_money_finance: Topic = topicSchema.parse(math_yr7_money_finance_json);
const math_yr7_negative_numbers: Topic = topicSchema.parse(math_yr7_negative_numbers_json);
const math_yr7_nets_3d_shapes: Topic = topicSchema.parse(math_yr7_nets_3d_shapes_json);
const math_yr7_percentages: Topic = topicSchema.parse(math_yr7_percentages_json);
const math_yr7_probability: Topic = topicSchema.parse(math_yr7_probability_json);
const math_yr7_rounding_estimation: Topic = topicSchema.parse(math_yr7_rounding_estimation_json);
const math_yr7_sequences: Topic = topicSchema.parse(math_yr7_sequences_json);
const math_yr7_substitution: Topic = topicSchema.parse(math_yr7_substitution_json);
const math_yr7_transformations: Topic = topicSchema.parse(math_yr7_transformations_json);
const math_yr7_venn_sets: Topic = topicSchema.parse(math_yr7_venn_sets_json);
const math_yr7_volume_surface_area: Topic = topicSchema.parse(math_yr7_volume_surface_area_json);
const math_yr8_angles_parallel_polygons: Topic = topicSchema.parse(math_yr8_angles_parallel_polygons_json);
const math_yr8_circles: Topic = topicSchema.parse(math_yr8_circles_json);
const math_yr8_compound_measures: Topic = topicSchema.parse(math_yr8_compound_measures_json);
const math_yr8_congruence_similarity: Topic = topicSchema.parse(math_yr8_congruence_similarity_json);
const math_yr8_factorising: Topic = topicSchema.parse(math_yr8_factorising_json);
const math_yr8_linear_equations: Topic = topicSchema.parse(math_yr8_linear_equations_json);
const math_yr8_percentages_ratio_proportion: Topic = topicSchema.parse(math_yr8_percentages_ratio_proportion_json);
const math_yr8_probability_trees: Topic = topicSchema.parse(math_yr8_probability_trees_json);
const math_yr8_pythagoras: Topic = topicSchema.parse(math_yr8_pythagoras_json);
const math_yr8_sequences: Topic = topicSchema.parse(math_yr8_sequences_json);
const math_yr8_standard_form: Topic = topicSchema.parse(math_yr8_standard_form_json);
const math_yr8_statistics_averages: Topic = topicSchema.parse(math_yr8_statistics_averages_json);
const math_yr8_straight_line_graphs: Topic = topicSchema.parse(math_yr8_straight_line_graphs_json);
const math_yr8_transformations: Topic = topicSchema.parse(math_yr8_transformations_json);
const math_yr8_volume_surface_area: Topic = topicSchema.parse(math_yr8_volume_surface_area_json);
const math_yr9_3d_geometry: Topic = topicSchema.parse(math_yr9_3d_geometry_json);
const math_yr9_error_intervals: Topic = topicSchema.parse(math_yr9_error_intervals_json);
const math_yr9_quadratic_expressions: Topic = topicSchema.parse(math_yr9_quadratic_expressions_json);
const math_yr9_quadratic_graphs: Topic = topicSchema.parse(math_yr9_quadratic_graphs_json);
const math_yr9_standard_form: Topic = topicSchema.parse(math_yr9_standard_form_json);
const math_yr9_surds: Topic = topicSchema.parse(math_yr9_surds_json);
const eng_creative_1: Topic = topicSchema.parse(eng_creative_1_json);
const eng_drama_shakespeare: Topic = topicSchema.parse(eng_drama_shakespeare_json);
const eng_essay_1: Topic = topicSchema.parse(eng_essay_1_json);
const eng_figurative_1: Topic = topicSchema.parse(eng_figurative_1_json);
const eng_grammar_1: Topic = topicSchema.parse(eng_grammar_1_json);
const eng_media_visual_literacy: Topic = topicSchema.parse(eng_media_visual_literacy_json);
const eng_myths_legends: Topic = topicSchema.parse(eng_myths_legends_json);
const eng_narrative_1: Topic = topicSchema.parse(eng_narrative_1_json);
const eng_nonfiction_1: Topic = topicSchema.parse(eng_nonfiction_1_json);
const eng_novel_study_1: Topic = topicSchema.parse(eng_novel_study_1_json);
const eng_persuasive_1: Topic = topicSchema.parse(eng_persuasive_1_json);
const eng_persuasive_speaking_1: Topic = topicSchema.parse(eng_persuasive_speaking_1_json);
const eng_poetry_1: Topic = topicSchema.parse(eng_poetry_1_json);
const eng_poetry_writing_1: Topic = topicSchema.parse(eng_poetry_writing_1_json);
const eng_reading_1: Topic = topicSchema.parse(eng_reading_1_json);
const eng_speaking_1: Topic = topicSchema.parse(eng_speaking_1_json);
const eng_spelling_1: Topic = topicSchema.parse(eng_spelling_1_json);
const bio_body_1: Topic = topicSchema.parse(bio_body_1_json);
const bio_cell_1: Topic = topicSchema.parse(bio_cell_1_json);
const bio_classification_1: Topic = topicSchema.parse(bio_classification_1_json);
const bio_ecology_1: Topic = topicSchema.parse(bio_ecology_1_json);
const bio_genetics_1: Topic = topicSchema.parse(bio_genetics_1_json);
const bio_health_1: Topic = topicSchema.parse(bio_health_1_json);
const bio_human_reproduction_1: Topic = topicSchema.parse(bio_human_reproduction_1_json);
const bio_microorganisms_1: Topic = topicSchema.parse(bio_microorganisms_1_json);
const bio_photosynthesis_1: Topic = topicSchema.parse(bio_photosynthesis_1_json);
const bio_plants_1: Topic = topicSchema.parse(bio_plants_1_json);
const bio_practical_1: Topic = topicSchema.parse(bio_practical_1_json);
const bio_reproduction_1: Topic = topicSchema.parse(bio_reproduction_1_json);
const bio_respiration_1: Topic = topicSchema.parse(bio_respiration_1_json);
const chem_acids_1: Topic = topicSchema.parse(chem_acids_1_json);
const chem_atomic_1: Topic = topicSchema.parse(chem_atomic_1_json);
const chem_bonding_1: Topic = topicSchema.parse(chem_bonding_1_json);
const chem_changes_1: Topic = topicSchema.parse(chem_changes_1_json);
const chem_earth_1: Topic = topicSchema.parse(chem_earth_1_json);
const chem_metals_1: Topic = topicSchema.parse(chem_metals_1_json);
const chem_mixtures_1: Topic = topicSchema.parse(chem_mixtures_1_json);
const chem_organic_1: Topic = topicSchema.parse(chem_organic_1_json);
const chem_periodic_1: Topic = topicSchema.parse(chem_periodic_1_json);
const chem_rates_1: Topic = topicSchema.parse(chem_rates_1_json);
const chem_states_1: Topic = topicSchema.parse(chem_states_1_json);
const chem_working_scientifically_1: Topic = topicSchema.parse(chem_working_scientifically_1_json);
const phys_electricity_1: Topic = topicSchema.parse(phys_electricity_1_json);
const phys_energy_1: Topic = topicSchema.parse(phys_energy_1_json);
const phys_energy_resources_1: Topic = topicSchema.parse(phys_energy_resources_1_json);
const phys_forces_1: Topic = topicSchema.parse(phys_forces_1_json);
const phys_forces_action_1: Topic = topicSchema.parse(phys_forces_action_1_json);
const phys_light_1: Topic = topicSchema.parse(phys_light_1_json);
const phys_magnetism_1: Topic = topicSchema.parse(phys_magnetism_1_json);
const phys_particles_1: Topic = topicSchema.parse(phys_particles_1_json);
const phys_pressure_1: Topic = topicSchema.parse(phys_pressure_1_json);
const phys_radioactivity_1: Topic = topicSchema.parse(phys_radioactivity_1_json);
const phys_space_1: Topic = topicSchema.parse(phys_space_1_json);
const phys_waves_1: Topic = topicSchema.parse(phys_waves_1_json);
const phys_working_scientifically_1: Topic = topicSchema.parse(phys_working_scientifically_1_json);

const bio_ks3_bio_ks3_set_1: Paper = paperSchema.parse(bio_ks3_bio_ks3_set_1_json);
const chem_ks3_chem_ks3_set_1: Paper = paperSchema.parse(chem_ks3_chem_ks3_set_1_json);
const eng_ks3_eng_ks3_set_1: Paper = paperSchema.parse(eng_ks3_eng_ks3_set_1_json);
const math_dp_ai_math_dp_ai_set_1: Paper = paperSchema.parse(math_dp_ai_math_dp_ai_set_1_json);
const math_y7_math_y7_set_1: Paper = paperSchema.parse(math_y7_math_y7_set_1_json);
const math_y8_math_y8_set_1: Paper = paperSchema.parse(math_y8_math_y8_set_1_json);
const math_y9_math_y9_set_1: Paper = paperSchema.parse(math_y9_math_y9_set_1_json);
const phys_ks3_phys_ks3_set_1: Paper = paperSchema.parse(phys_ks3_phys_ks3_set_1_json);

const validatedSubjectsMeta = subjectMetaSchema.array().parse(subjectsMeta);

const mathMeta = validatedSubjectsMeta.find((s) => s.id === 'math')!;
const englishMeta = validatedSubjectsMeta.find((s) => s.id === 'english')!;
const biologyMeta = validatedSubjectsMeta.find((s) => s.id === 'biology')!;
const chemistryMeta = validatedSubjectsMeta.find((s) => s.id === 'chemistry')!;
const physicsMeta = validatedSubjectsMeta.find((s) => s.id === 'physics')!;

const mathSubject: Subject = {
  id: mathMeta.id as SubjectId,
  name: mathMeta.name,
  icon: mathMeta.icon,
  accentColor: mathMeta.accentColor,
  topics: [math_algebra_1, math_dp_ai_binomial, math_dp_ai_complex_numbers, math_dp_ai_correlation_regression, math_dp_ai_descriptive_statistics, math_dp_ai_differentiation, math_dp_ai_explog, math_dp_ai_exponents, math_dp_ai_functions, math_dp_ai_graph_theory, math_dp_ai_hypothesis_testing, math_dp_ai_integration, math_dp_ai_kinematics, math_dp_ai_matrices, math_dp_ai_poisson_distribution, math_dp_ai_probability, math_dp_ai_quadratics, math_dp_ai_sequences, math_dp_ai_trig, math_dp_ai_vectors, math_dp_ai_voronoi_diagrams, math_fractions_1, math_geometry_1, math_inequalities_myp, math_linear_myp, math_powers_myp, math_pythagoras_myp, math_ratio_myp, math_simultaneous_myp, math_statistics_1, math_trig_basic_myp, math_yr7_algebraic_expressions, math_yr7_angles, math_yr7_area_perimeter, math_yr7_bearings_scale, math_yr7_calculations, math_yr7_constructions_loci, math_yr7_data, math_yr7_decimals, math_yr7_equations, math_yr7_factors_multiples, math_yr7_measures_conversions, math_yr7_money_finance, math_yr7_negative_numbers, math_yr7_nets_3d_shapes, math_yr7_percentages, math_yr7_probability, math_yr7_rounding_estimation, math_yr7_sequences, math_yr7_substitution, math_yr7_transformations, math_yr7_venn_sets, math_yr7_volume_surface_area, math_yr8_angles_parallel_polygons, math_yr8_circles, math_yr8_compound_measures, math_yr8_congruence_similarity, math_yr8_factorising, math_yr8_linear_equations, math_yr8_percentages_ratio_proportion, math_yr8_probability_trees, math_yr8_pythagoras, math_yr8_sequences, math_yr8_standard_form, math_yr8_statistics_averages, math_yr8_straight_line_graphs, math_yr8_transformations, math_yr8_volume_surface_area, math_yr9_3d_geometry, math_yr9_error_intervals, math_yr9_quadratic_expressions, math_yr9_quadratic_graphs, math_yr9_standard_form, math_yr9_surds],
};
const englishSubject: Subject = {
  id: englishMeta.id as SubjectId,
  name: englishMeta.name,
  icon: englishMeta.icon,
  accentColor: englishMeta.accentColor,
  topics: [eng_creative_1, eng_drama_shakespeare, eng_essay_1, eng_figurative_1, eng_grammar_1, eng_media_visual_literacy, eng_myths_legends, eng_narrative_1, eng_nonfiction_1, eng_novel_study_1, eng_persuasive_1, eng_persuasive_speaking_1, eng_poetry_1, eng_poetry_writing_1, eng_reading_1, eng_speaking_1, eng_spelling_1],
};
const biologySubject: Subject = {
  id: biologyMeta.id as SubjectId,
  name: biologyMeta.name,
  icon: biologyMeta.icon,
  accentColor: biologyMeta.accentColor,
  topics: [bio_body_1, bio_cell_1, bio_classification_1, bio_ecology_1, bio_genetics_1, bio_health_1, bio_human_reproduction_1, bio_microorganisms_1, bio_photosynthesis_1, bio_plants_1, bio_practical_1, bio_reproduction_1, bio_respiration_1],
};
const chemistrySubject: Subject = {
  id: chemistryMeta.id as SubjectId,
  name: chemistryMeta.name,
  icon: chemistryMeta.icon,
  accentColor: chemistryMeta.accentColor,
  topics: [chem_acids_1, chem_atomic_1, chem_bonding_1, chem_changes_1, chem_earth_1, chem_metals_1, chem_mixtures_1, chem_organic_1, chem_periodic_1, chem_rates_1, chem_states_1, chem_working_scientifically_1],
};
const physicsSubject: Subject = {
  id: physicsMeta.id as SubjectId,
  name: physicsMeta.name,
  icon: physicsMeta.icon,
  accentColor: physicsMeta.accentColor,
  topics: [phys_electricity_1, phys_energy_1, phys_energy_resources_1, phys_forces_1, phys_forces_action_1, phys_light_1, phys_magnetism_1, phys_particles_1, phys_pressure_1, phys_radioactivity_1, phys_space_1, phys_waves_1, phys_working_scientifically_1],
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

const papers: Paper[] = [bio_ks3_bio_ks3_set_1, chem_ks3_chem_ks3_set_1, eng_ks3_eng_ks3_set_1, math_dp_ai_math_dp_ai_set_1, math_y7_math_y7_set_1, math_y8_math_y8_set_1, math_y9_math_y9_set_1, phys_ks3_phys_ks3_set_1];

export function getAllPapers(): Paper[] {
  return papers;
}

export function getPapersForCourse(courseId: string): Paper[] {
  return papers.filter((p) => p.courseId === courseId);
}

export function getPaper(courseId: string, paperId: string): Paper | undefined {
  return papers.find((p) => p.id === paperId && p.courseId === courseId);
}
