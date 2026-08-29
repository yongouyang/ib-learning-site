import { Subject, SubjectId } from './types';
import type { Topic, Paper } from './types';
import { topicSchema, subjectMetaSchema, paperSchema } from './schema';

import subjectsMeta from './data/subjects.json';

// Math topics
import math_yr7_calculations_json from './data/topics/math/math-yr7-calculations.json';
import math_yr7_negative_numbers_json from './data/topics/math/math-yr7-negative-numbers.json';
import math_yr7_factors_multiples_json from './data/topics/math/math-yr7-factors-multiples.json';
import math_yr7_rounding_estimation_json from './data/topics/math/math-yr7-rounding-estimation.json';
import math_fractions_1_json from './data/topics/math/math-fractions-1.json';
import math_yr7_decimals_json from './data/topics/math/math-yr7-decimals.json';
import math_yr7_percentages_json from './data/topics/math/math-yr7-percentages.json';
import math_yr7_number_bases_json from './data/topics/math/math-yr7-number-bases.json';
import math_yr7_money_finance_json from './data/topics/math/math-yr7-money-finance.json';
import math_algebra_1_json from './data/topics/math/math-algebra-1.json';
import math_yr7_substitution_json from './data/topics/math/math-yr7-substitution.json';
import math_yr7_algebraic_expressions_json from './data/topics/math/math-yr7-algebraic-expressions.json';
import math_yr7_equations_json from './data/topics/math/math-yr7-equations.json';
import math_yr7_sequences_json from './data/topics/math/math-yr7-sequences.json';
import math_yr7_measures_conversions_json from './data/topics/math/math-yr7-measures-conversions.json';
import math_yr7_angles_json from './data/topics/math/math-yr7-angles.json';
import math_geometry_1_json from './data/topics/math/math-geometry-1.json';
import math_yr7_area_perimeter_json from './data/topics/math/math-yr7-area-perimeter.json';
import math_yr7_nets_3d_shapes_json from './data/topics/math/math-yr7-nets-3d-shapes.json';
import math_yr7_volume_surface_area_json from './data/topics/math/math-yr7-volume-surface-area.json';
import math_yr7_transformations_json from './data/topics/math/math-yr7-transformations.json';
import math_yr7_constructions_loci_json from './data/topics/math/math-yr7-constructions-loci.json';
import math_yr7_bearings_scale_json from './data/topics/math/math-yr7-bearings-scale.json';
import math_yr7_data_json from './data/topics/math/math-yr7-data.json';
import math_yr7_probability_json from './data/topics/math/math-yr7-probability.json';
import math_yr7_venn_sets_json from './data/topics/math/math-yr7-venn-sets.json';
import math_statistics_1_json from './data/topics/math/math-statistics-1.json';
import math_yr8_standard_form_json from './data/topics/math/math-yr8-standard-form.json';
import math_yr8_percentages_ratio_proportion_json from './data/topics/math/math-yr8-percentages-ratio-proportion.json';
import math_yr8_sequences_json from './data/topics/math/math-yr8-sequences.json';
import math_yr8_factorising_json from './data/topics/math/math-yr8-factorising.json';
import math_yr8_linear_equations_json from './data/topics/math/math-yr8-linear-equations.json';
import math_yr8_straight_line_graphs_json from './data/topics/math/math-yr8-straight-line-graphs.json';
import math_yr8_angles_parallel_polygons_json from './data/topics/math/math-yr8-angles-parallel-polygons.json';
import math_yr8_circles_json from './data/topics/math/math-yr8-circles.json';
import math_yr8_transformations_json from './data/topics/math/math-yr8-transformations.json';
import math_yr8_congruence_similarity_json from './data/topics/math/math-yr8-congruence-similarity.json';
import math_yr8_pythagoras_json from './data/topics/math/math-yr8-pythagoras.json';
import math_yr8_volume_surface_area_json from './data/topics/math/math-yr8-volume-surface-area.json';
import math_yr8_compound_measures_json from './data/topics/math/math-yr8-compound-measures.json';
import math_yr8_statistics_averages_json from './data/topics/math/math-yr8-statistics-averages.json';
import math_yr8_probability_trees_json from './data/topics/math/math-yr8-probability-trees.json';
import math_powers_myp_json from './data/topics/math/math-powers-myp.json';
import math_yr9_standard_form_json from './data/topics/math/math-yr9-standard-form.json';
import math_yr9_surds_json from './data/topics/math/math-yr9-surds.json';
import math_yr9_error_intervals_json from './data/topics/math/math-yr9-error-intervals.json';
import math_ratio_myp_json from './data/topics/math/math-ratio-myp.json';
import math_linear_myp_json from './data/topics/math/math-linear-myp.json';
import math_inequalities_myp_json from './data/topics/math/math-inequalities-myp.json';
import math_simultaneous_myp_json from './data/topics/math/math-simultaneous-myp.json';
import math_yr9_quadratic_expressions_json from './data/topics/math/math-yr9-quadratic-expressions.json';
import math_yr9_quadratic_graphs_json from './data/topics/math/math-yr9-quadratic-graphs.json';
import math_yr9_3d_geometry_json from './data/topics/math/math-yr9-3d-geometry.json';
import math_pythagoras_myp_json from './data/topics/math/math-pythagoras-myp.json';
import math_trig_basic_myp_json from './data/topics/math/math-trig-basic-myp.json';
import math_yr9_scatter_graphs_json from './data/topics/math/math-yr9-scatter-graphs.json';
import math_dp_ai_sequences_json from './data/topics/math/math-dp-ai-sequences.json';
import math_dp_ai_exponents_json from './data/topics/math/math-dp-ai-exponents.json';
import math_dp_ai_binomial_json from './data/topics/math/math-dp-ai-binomial.json';
import math_dp_ai_functions_json from './data/topics/math/math-dp-ai-functions.json';
import math_dp_ai_quadratics_json from './data/topics/math/math-dp-ai-quadratics.json';
import math_dp_ai_explog_json from './data/topics/math/math-dp-ai-explog.json';
import math_dp_ai_trig_json from './data/topics/math/math-dp-ai-trig.json';
import math_dp_ai_vectors_json from './data/topics/math/math-dp-ai-vectors.json';
import math_dp_ai_voronoi_diagrams_json from './data/topics/math/math-dp-ai-voronoi-diagrams.json';
import math_dp_ai_descriptive_statistics_json from './data/topics/math/math-dp-ai-descriptive-statistics.json';
import math_dp_ai_probability_json from './data/topics/math/math-dp-ai-probability.json';
import math_dp_ai_correlation_regression_json from './data/topics/math/math-dp-ai-correlation-regression.json';
import math_dp_ai_hypothesis_testing_json from './data/topics/math/math-dp-ai-hypothesis-testing.json';
import math_dp_ai_differentiation_json from './data/topics/math/math-dp-ai-differentiation.json';
import math_dp_ai_integration_json from './data/topics/math/math-dp-ai-integration.json';
import math_dp_ai_kinematics_json from './data/topics/math/math-dp-ai-kinematics.json';
import math_dp_ai_complex_numbers_json from './data/topics/math/math-dp-ai-complex-numbers.json';
import math_dp_ai_matrices_json from './data/topics/math/math-dp-ai-matrices.json';
import math_dp_ai_graph_theory_json from './data/topics/math/math-dp-ai-graph-theory.json';
import math_dp_ai_poisson_distribution_json from './data/topics/math/math-dp-ai-poisson-distribution.json';
// English topics
import eng_reading_1_json from './data/topics/english/eng-reading-1.json';
import eng_figurative_1_json from './data/topics/english/eng-figurative-1.json';
import eng_myths_legends_json from './data/topics/english/eng-myths-legends.json';
import eng_yr7_graphic_novels_json from './data/topics/english/eng-yr7-graphic-novels.json';
import eng_yr7_short_story_json from './data/topics/english/eng-yr7-short-story.json';
import eng_novel_study_1_json from './data/topics/english/eng-novel-study-1.json';
import eng_nonfiction_1_json from './data/topics/english/eng-nonfiction-1.json';
import eng_media_visual_literacy_json from './data/topics/english/eng-media-visual-literacy.json';
import eng_drama_shakespeare_json from './data/topics/english/eng-drama-shakespeare.json';
import eng_yr8_modern_drama_json from './data/topics/english/eng-yr8-modern-drama.json';
import eng_poetry_1_json from './data/topics/english/eng-poetry-1.json';
import eng_poetry_2_json from './data/topics/english/eng-poetry-2.json';
import eng_critical_reading_1_json from './data/topics/english/eng-critical-reading-1.json';
import eng_yr9_close_reading_json from './data/topics/english/eng-yr9-close-reading.json';
import eng_yr9_war_poetry_json from './data/topics/english/eng-yr9-war-poetry.json';
import eng_creative_1_json from './data/topics/english/eng-creative-1.json';
import eng_yr7_identity_autobiography_json from './data/topics/english/eng-yr7-identity-autobiography.json';
import eng_narrative_1_json from './data/topics/english/eng-narrative-1.json';
import eng_yr8_short_story_writing_json from './data/topics/english/eng-yr8-short-story-writing.json';
import eng_yr9_descriptive_writing_json from './data/topics/english/eng-yr9-descriptive-writing.json';
import eng_creative_2_json from './data/topics/english/eng-creative-2.json';
import eng_persuasive_1_json from './data/topics/english/eng-persuasive-1.json';
import eng_nonfiction_writing_1_json from './data/topics/english/eng-nonfiction-writing-1.json';
import eng_yr9_letters_interviews_json from './data/topics/english/eng-yr9-letters-interviews.json';
import eng_essay_1_json from './data/topics/english/eng-essay-1.json';
import eng_essay_2_json from './data/topics/english/eng-essay-2.json';
import eng_poetry_writing_1_json from './data/topics/english/eng-poetry-writing-1.json';
import eng_spelling_1_json from './data/topics/english/eng-spelling-1.json';
import eng_grammar_1_json from './data/topics/english/eng-grammar-1.json';
import eng_grammar_2_json from './data/topics/english/eng-grammar-2.json';
import eng_punctuation_1_json from './data/topics/english/eng-punctuation-1.json';
import eng_speaking_1_json from './data/topics/english/eng-speaking-1.json';
import eng_spoken_language_1_json from './data/topics/english/eng-spoken-language-1.json';
import eng_persuasive_speaking_1_json from './data/topics/english/eng-persuasive-speaking-1.json';
// Biology topics
import bio_practical_1_json from './data/topics/biology/bio-practical-1.json';
import bio_cell_1_json from './data/topics/biology/bio-cell-1.json';
import bio_body_1_json from './data/topics/biology/bio-body-1.json';
import bio_nutrition_1_json from './data/topics/biology/bio-nutrition-1.json';
import bio_photosynthesis_1_json from './data/topics/biology/bio-photosynthesis-1.json';
import bio_respiration_1_json from './data/topics/biology/bio-respiration-1.json';
import bio_plants_1_json from './data/topics/biology/bio-plants-1.json';
import bio_health_1_json from './data/topics/biology/bio-health-1.json';
import bio_human_reproduction_1_json from './data/topics/biology/bio-human-reproduction-1.json';
import bio_classification_1_json from './data/topics/biology/bio-classification-1.json';
import bio_genetics_1_json from './data/topics/biology/bio-genetics-1.json';
import bio_ecology_1_json from './data/topics/biology/bio-ecology-1.json';
import bio_microorganisms_1_json from './data/topics/biology/bio-microorganisms-1.json';
import bio_reproduction_1_json from './data/topics/biology/bio-reproduction-1.json';
// Chemistry topics
import chem_working_scientifically_1_json from './data/topics/chemistry/chem-working-scientifically-1.json';
import chem_states_1_json from './data/topics/chemistry/chem-states-1.json';
import chem_mixtures_1_json from './data/topics/chemistry/chem-mixtures-1.json';
import chem_acids_1_json from './data/topics/chemistry/chem-acids-1.json';
import chem_changes_1_json from './data/topics/chemistry/chem-changes-1.json';
import chem_periodic_1_json from './data/topics/chemistry/chem-periodic-1.json';
import chem_metals_1_json from './data/topics/chemistry/chem-metals-1.json';
import chem_atomic_1_json from './data/topics/chemistry/chem-atomic-1.json';
import chem_bonding_1_json from './data/topics/chemistry/chem-bonding-1.json';
import chem_rates_1_json from './data/topics/chemistry/chem-rates-1.json';
import chem_organic_1_json from './data/topics/chemistry/chem-organic-1.json';
import chem_ion_tests_1_json from './data/topics/chemistry/chem-ion-tests-1.json';
import chem_earth_1_json from './data/topics/chemistry/chem-earth-1.json';
// Physics topics
import phys_working_scientifically_1_json from './data/topics/physics/phys-working-scientifically-1.json';
import phys_energy_1_json from './data/topics/physics/phys-energy-1.json';
import phys_forces_1_json from './data/topics/physics/phys-forces-1.json';
import phys_forces_action_1_json from './data/topics/physics/phys-forces-action-1.json';
import phys_waves_1_json from './data/topics/physics/phys-waves-1.json';
import phys_light_1_json from './data/topics/physics/phys-light-1.json';
import phys_magnetism_1_json from './data/topics/physics/phys-magnetism-1.json';
import phys_space_1_json from './data/topics/physics/phys-space-1.json';
import phys_particles_1_json from './data/topics/physics/phys-particles-1.json';
import phys_electricity_1_json from './data/topics/physics/phys-electricity-1.json';
import phys_pressure_1_json from './data/topics/physics/phys-pressure-1.json';
import phys_simple_machines_1_json from './data/topics/physics/phys-simple-machines-1.json';
import phys_radioactivity_1_json from './data/topics/physics/phys-radioactivity-1.json';
import phys_energy_resources_1_json from './data/topics/physics/phys-energy-resources-1.json';
// Geography topics
import geo_yr7_what_is_geography_json from './data/topics/geography/geo-yr7-what-is-geography.json';
import geo_yr7_weather_climate_intro_json from './data/topics/geography/geo-yr7-weather-climate-intro.json';
import geo_yr7_rivers_landforms_json from './data/topics/geography/geo-yr7-rivers-landforms.json';
import geo_yr7_population_urban_json from './data/topics/geography/geo-yr7-population-urban.json';
import geo_yr8_plate_tectonics_json from './data/topics/geography/geo-yr8-plate-tectonics.json';
import geo_yr8_world_climates_biomes_json from './data/topics/geography/geo-yr8-world-climates-biomes.json';
import geo_yr8_climate_change_json from './data/topics/geography/geo-yr8-climate-change.json';
import geo_yr9_development_json from './data/topics/geography/geo-yr9-development.json';
import geo_yr9_migration_globalisation_json from './data/topics/geography/geo-yr9-migration-globalisation.json';
import geo_yr9_urbanisation_sustainable_cities_json from './data/topics/geography/geo-yr9-urbanisation-sustainable-cities.json';
// History topics
import hist_yr7_intro_history_skills_json from './data/topics/history/hist-yr7-intro-history-skills.json';
import hist_yr7_medieval_china_json from './data/topics/history/hist-yr7-medieval-china.json';
import hist_yr7_medieval_europe_json from './data/topics/history/hist-yr7-medieval-europe.json';
import hist_yr8_ww1_json from './data/topics/history/hist-yr8-ww1.json';
import hist_yr8_russian_revolution_json from './data/topics/history/hist-yr8-russian-revolution.json';
import hist_yr8_india_independence_partition_json from './data/topics/history/hist-yr8-india-independence-partition.json';
import hist_yr9_weimar_nazi_rise_json from './data/topics/history/hist-yr9-weimar-nazi-rise.json';
import hist_yr9_nazi_germany_json from './data/topics/history/hist-yr9-nazi-germany.json';
import hist_yr9_ww2_europe_json from './data/topics/history/hist-yr9-ww2-europe.json';
import hist_yr9_ww2_asia_json from './data/topics/history/hist-yr9-ww2-asia.json';
import hist_yr9_holocaust_json from './data/topics/history/hist-yr9-holocaust.json';
// ICT topics
import ict_yr7_scratch_stem_json from './data/topics/ict/ict-yr7-scratch-stem.json';
import ict_yr7_python_basics_json from './data/topics/ict/ict-yr7-python-basics.json';
import ict_yr7_spreadsheets_json from './data/topics/ict/ict-yr7-spreadsheets.json';
import ict_yr7_image_editing_json from './data/topics/ict/ict-yr7-image-editing.json';
import ict_yr7_web_html_css_json from './data/topics/ict/ict-yr7-web-html-css.json';
import ict_yr8_python_next_json from './data/topics/ict/ict-yr8-python-next.json';
import ict_yr8_animation_json from './data/topics/ict/ict-yr8-animation.json';
import ict_yr8_3d_design_json from './data/topics/ict/ict-yr8-3d-design.json';
import ict_yr9_microprocessors_json from './data/topics/ict/ict-yr9-microprocessors.json';
import ict_yr9_python_projects_json from './data/topics/ict/ict-yr9-python-projects.json';
import ict_yr9_video_production_json from './data/topics/ict/ict-yr9-video-production.json';
import ict_yr9_understanding_ai_json from './data/topics/ict/ict-yr9-understanding-ai.json';
// Chinese topics
import chin_yr7_pinyin_tones_characters_json from './data/topics/chinese/chin-yr7-pinyin-tones-characters.json';
import chin_yr7_greetings_names_json from './data/topics/chinese/chin-yr7-greetings-names.json';
import chin_yr7_numbers_dates_time_json from './data/topics/chinese/chin-yr7-numbers-dates-time.json';
import chin_yr7_family_pets_json from './data/topics/chinese/chin-yr7-family-pets.json';
import chin_yr7_food_meals_json from './data/topics/chinese/chin-yr7-food-meals.json';
import chin_yr7_colours_clothes_json from './data/topics/chinese/chin-yr7-colours-clothes.json';
import chin_yr8_home_rooms_json from './data/topics/chinese/chin-yr8-home-rooms.json';
import chin_yr8_hobbies_daily_routine_json from './data/topics/chinese/chin-yr8-hobbies-daily-routine.json';
import chin_yr8_school_life_json from './data/topics/chinese/chin-yr8-school-life.json';
import chin_yr8_weather_seasons_json from './data/topics/chinese/chin-yr8-weather-seasons.json';
import chin_yr8_fairy_tales_fables_json from './data/topics/chinese/chin-yr8-fairy-tales-fables.json';
import chin_yr8_idioms_chengyu_json from './data/topics/chinese/chin-yr8-idioms-chengyu.json';
import chin_yr9_body_health_json from './data/topics/chinese/chin-yr9-body-health.json';
import chin_yr9_places_directions_json from './data/topics/chinese/chin-yr9-places-directions.json';
import chin_yr9_shopping_gifts_json from './data/topics/chinese/chin-yr9-shopping-gifts.json';
import chin_yr9_festivals_celebrations_json from './data/topics/chinese/chin-yr9-festivals-celebrations.json';
import chin_yr9_myths_legends_json from './data/topics/chinese/chin-yr9-myths-legends.json';
import chin_yr9_culture_inventions_json from './data/topics/chinese/chin-yr9-culture-inventions.json';
import chin_yr9_descriptive_scenery_texts_json from './data/topics/chinese/chin-yr9-descriptive-scenery-texts.json';
import chin_yr9_poetry_json from './data/topics/chinese/chin-yr9-poetry.json';
// German topics
import germ_yr7_greetings_basics_json from './data/topics/german/germ-yr7-greetings-basics.json';
import germ_yr7_family_home_json from './data/topics/german/germ-yr7-family-home.json';
import germ_yr7_freetime_hobbies_json from './data/topics/german/germ-yr7-freetime-hobbies.json';
import germ_yr7_school_life_json from './data/topics/german/germ-yr7-school-life.json';
import germ_yr7_animals_colours_json from './data/topics/german/germ-yr7-animals-colours.json';
import germ_yr8_feelings_friendship_json from './data/topics/german/germ-yr8-feelings-friendship.json';
import germ_yr8_food_drink_json from './data/topics/german/germ-yr8-food-drink.json';
import germ_yr8_shopping_clothes_json from './data/topics/german/germ-yr8-shopping-clothes.json';
import germ_yr8_town_directions_json from './data/topics/german/germ-yr8-town-directions.json';
import germ_yr8_travel_places_json from './data/topics/german/germ-yr8-travel-places.json';
import germ_yr9_housing_rooms_json from './data/topics/german/germ-yr9-housing-rooms.json';
import germ_yr9_celebrations_health_json from './data/topics/german/germ-yr9-celebrations-health.json';
import germ_yr9_jobs_professions_json from './data/topics/german/germ-yr9-jobs-professions.json';

// bio-ks3 practice sets
import bio_ks3_bio_ks3_set_1_json from './data/papers/bio-ks3/bio-ks3-set-1.json';
import bio_ks3_bio_ks3_set_2_json from './data/papers/bio-ks3/bio-ks3-set-2.json';
// chem-ks3 practice sets
import chem_ks3_chem_ks3_set_1_json from './data/papers/chem-ks3/chem-ks3-set-1.json';
import chem_ks3_chem_ks3_set_2_json from './data/papers/chem-ks3/chem-ks3-set-2.json';
// chin-ks3 practice sets
import chin_ks3_chin_ks3_set_1_json from './data/papers/chin-ks3/chin-ks3-set-1.json';
import chin_ks3_chin_ks3_set_2_json from './data/papers/chin-ks3/chin-ks3-set-2.json';
// eng-ks3 practice sets
import eng_ks3_eng_ks3_set_1_json from './data/papers/eng-ks3/eng-ks3-set-1.json';
import eng_ks3_eng_ks3_set_2_json from './data/papers/eng-ks3/eng-ks3-set-2.json';
// geog-ks3 practice sets
import geog_ks3_geog_ks3_set_1_json from './data/papers/geog-ks3/geog-ks3-set-1.json';
import geog_ks3_geog_ks3_set_2_json from './data/papers/geog-ks3/geog-ks3-set-2.json';
// germ-ks3 practice sets
import germ_ks3_germ_ks3_set_1_json from './data/papers/germ-ks3/germ-ks3-set-1.json';
import germ_ks3_germ_ks3_set_2_json from './data/papers/germ-ks3/germ-ks3-set-2.json';
// hist-ks3 practice sets
import hist_ks3_hist_ks3_set_1_json from './data/papers/hist-ks3/hist-ks3-set-1.json';
import hist_ks3_hist_ks3_set_2_json from './data/papers/hist-ks3/hist-ks3-set-2.json';
// ict-ks3 practice sets
import ict_ks3_ict_ks3_set_1_json from './data/papers/ict-ks3/ict-ks3-set-1.json';
import ict_ks3_ict_ks3_set_2_json from './data/papers/ict-ks3/ict-ks3-set-2.json';
// math-dp-ai practice sets
import math_dp_ai_math_dp_ai_set_1_json from './data/papers/math-dp-ai/math-dp-ai-set-1.json';
import math_dp_ai_math_dp_ai_set_2_json from './data/papers/math-dp-ai/math-dp-ai-set-2.json';
// math-y7 practice sets
import math_y7_math_y7_set_1_json from './data/papers/math-y7/math-y7-set-1.json';
import math_y7_math_y7_set_2_json from './data/papers/math-y7/math-y7-set-2.json';
// math-y8 practice sets
import math_y8_math_y8_set_1_json from './data/papers/math-y8/math-y8-set-1.json';
import math_y8_math_y8_set_2_json from './data/papers/math-y8/math-y8-set-2.json';
// math-y9 practice sets
import math_y9_math_y9_set_1_json from './data/papers/math-y9/math-y9-set-1.json';
import math_y9_math_y9_set_2_json from './data/papers/math-y9/math-y9-set-2.json';
// phys-ks3 practice sets
import phys_ks3_phys_ks3_set_1_json from './data/papers/phys-ks3/phys-ks3-set-1.json';
import phys_ks3_phys_ks3_set_2_json from './data/papers/phys-ks3/phys-ks3-set-2.json';

const math_yr7_calculations: Topic = topicSchema.parse(math_yr7_calculations_json);
const math_yr7_negative_numbers: Topic = topicSchema.parse(math_yr7_negative_numbers_json);
const math_yr7_factors_multiples: Topic = topicSchema.parse(math_yr7_factors_multiples_json);
const math_yr7_rounding_estimation: Topic = topicSchema.parse(math_yr7_rounding_estimation_json);
const math_fractions_1: Topic = topicSchema.parse(math_fractions_1_json);
const math_yr7_decimals: Topic = topicSchema.parse(math_yr7_decimals_json);
const math_yr7_percentages: Topic = topicSchema.parse(math_yr7_percentages_json);
const math_yr7_number_bases: Topic = topicSchema.parse(math_yr7_number_bases_json);
const math_yr7_money_finance: Topic = topicSchema.parse(math_yr7_money_finance_json);
const math_algebra_1: Topic = topicSchema.parse(math_algebra_1_json);
const math_yr7_substitution: Topic = topicSchema.parse(math_yr7_substitution_json);
const math_yr7_algebraic_expressions: Topic = topicSchema.parse(math_yr7_algebraic_expressions_json);
const math_yr7_equations: Topic = topicSchema.parse(math_yr7_equations_json);
const math_yr7_sequences: Topic = topicSchema.parse(math_yr7_sequences_json);
const math_yr7_measures_conversions: Topic = topicSchema.parse(math_yr7_measures_conversions_json);
const math_yr7_angles: Topic = topicSchema.parse(math_yr7_angles_json);
const math_geometry_1: Topic = topicSchema.parse(math_geometry_1_json);
const math_yr7_area_perimeter: Topic = topicSchema.parse(math_yr7_area_perimeter_json);
const math_yr7_nets_3d_shapes: Topic = topicSchema.parse(math_yr7_nets_3d_shapes_json);
const math_yr7_volume_surface_area: Topic = topicSchema.parse(math_yr7_volume_surface_area_json);
const math_yr7_transformations: Topic = topicSchema.parse(math_yr7_transformations_json);
const math_yr7_constructions_loci: Topic = topicSchema.parse(math_yr7_constructions_loci_json);
const math_yr7_bearings_scale: Topic = topicSchema.parse(math_yr7_bearings_scale_json);
const math_yr7_data: Topic = topicSchema.parse(math_yr7_data_json);
const math_yr7_probability: Topic = topicSchema.parse(math_yr7_probability_json);
const math_yr7_venn_sets: Topic = topicSchema.parse(math_yr7_venn_sets_json);
const math_statistics_1: Topic = topicSchema.parse(math_statistics_1_json);
const math_yr8_standard_form: Topic = topicSchema.parse(math_yr8_standard_form_json);
const math_yr8_percentages_ratio_proportion: Topic = topicSchema.parse(math_yr8_percentages_ratio_proportion_json);
const math_yr8_sequences: Topic = topicSchema.parse(math_yr8_sequences_json);
const math_yr8_factorising: Topic = topicSchema.parse(math_yr8_factorising_json);
const math_yr8_linear_equations: Topic = topicSchema.parse(math_yr8_linear_equations_json);
const math_yr8_straight_line_graphs: Topic = topicSchema.parse(math_yr8_straight_line_graphs_json);
const math_yr8_angles_parallel_polygons: Topic = topicSchema.parse(math_yr8_angles_parallel_polygons_json);
const math_yr8_circles: Topic = topicSchema.parse(math_yr8_circles_json);
const math_yr8_transformations: Topic = topicSchema.parse(math_yr8_transformations_json);
const math_yr8_congruence_similarity: Topic = topicSchema.parse(math_yr8_congruence_similarity_json);
const math_yr8_pythagoras: Topic = topicSchema.parse(math_yr8_pythagoras_json);
const math_yr8_volume_surface_area: Topic = topicSchema.parse(math_yr8_volume_surface_area_json);
const math_yr8_compound_measures: Topic = topicSchema.parse(math_yr8_compound_measures_json);
const math_yr8_statistics_averages: Topic = topicSchema.parse(math_yr8_statistics_averages_json);
const math_yr8_probability_trees: Topic = topicSchema.parse(math_yr8_probability_trees_json);
const math_powers_myp: Topic = topicSchema.parse(math_powers_myp_json);
const math_yr9_standard_form: Topic = topicSchema.parse(math_yr9_standard_form_json);
const math_yr9_surds: Topic = topicSchema.parse(math_yr9_surds_json);
const math_yr9_error_intervals: Topic = topicSchema.parse(math_yr9_error_intervals_json);
const math_ratio_myp: Topic = topicSchema.parse(math_ratio_myp_json);
const math_linear_myp: Topic = topicSchema.parse(math_linear_myp_json);
const math_inequalities_myp: Topic = topicSchema.parse(math_inequalities_myp_json);
const math_simultaneous_myp: Topic = topicSchema.parse(math_simultaneous_myp_json);
const math_yr9_quadratic_expressions: Topic = topicSchema.parse(math_yr9_quadratic_expressions_json);
const math_yr9_quadratic_graphs: Topic = topicSchema.parse(math_yr9_quadratic_graphs_json);
const math_yr9_3d_geometry: Topic = topicSchema.parse(math_yr9_3d_geometry_json);
const math_pythagoras_myp: Topic = topicSchema.parse(math_pythagoras_myp_json);
const math_trig_basic_myp: Topic = topicSchema.parse(math_trig_basic_myp_json);
const math_yr9_scatter_graphs: Topic = topicSchema.parse(math_yr9_scatter_graphs_json);
const math_dp_ai_sequences: Topic = topicSchema.parse(math_dp_ai_sequences_json);
const math_dp_ai_exponents: Topic = topicSchema.parse(math_dp_ai_exponents_json);
const math_dp_ai_binomial: Topic = topicSchema.parse(math_dp_ai_binomial_json);
const math_dp_ai_functions: Topic = topicSchema.parse(math_dp_ai_functions_json);
const math_dp_ai_quadratics: Topic = topicSchema.parse(math_dp_ai_quadratics_json);
const math_dp_ai_explog: Topic = topicSchema.parse(math_dp_ai_explog_json);
const math_dp_ai_trig: Topic = topicSchema.parse(math_dp_ai_trig_json);
const math_dp_ai_vectors: Topic = topicSchema.parse(math_dp_ai_vectors_json);
const math_dp_ai_voronoi_diagrams: Topic = topicSchema.parse(math_dp_ai_voronoi_diagrams_json);
const math_dp_ai_descriptive_statistics: Topic = topicSchema.parse(math_dp_ai_descriptive_statistics_json);
const math_dp_ai_probability: Topic = topicSchema.parse(math_dp_ai_probability_json);
const math_dp_ai_correlation_regression: Topic = topicSchema.parse(math_dp_ai_correlation_regression_json);
const math_dp_ai_hypothesis_testing: Topic = topicSchema.parse(math_dp_ai_hypothesis_testing_json);
const math_dp_ai_differentiation: Topic = topicSchema.parse(math_dp_ai_differentiation_json);
const math_dp_ai_integration: Topic = topicSchema.parse(math_dp_ai_integration_json);
const math_dp_ai_kinematics: Topic = topicSchema.parse(math_dp_ai_kinematics_json);
const math_dp_ai_complex_numbers: Topic = topicSchema.parse(math_dp_ai_complex_numbers_json);
const math_dp_ai_matrices: Topic = topicSchema.parse(math_dp_ai_matrices_json);
const math_dp_ai_graph_theory: Topic = topicSchema.parse(math_dp_ai_graph_theory_json);
const math_dp_ai_poisson_distribution: Topic = topicSchema.parse(math_dp_ai_poisson_distribution_json);
const eng_reading_1: Topic = topicSchema.parse(eng_reading_1_json);
const eng_figurative_1: Topic = topicSchema.parse(eng_figurative_1_json);
const eng_myths_legends: Topic = topicSchema.parse(eng_myths_legends_json);
const eng_yr7_graphic_novels: Topic = topicSchema.parse(eng_yr7_graphic_novels_json);
const eng_yr7_short_story: Topic = topicSchema.parse(eng_yr7_short_story_json);
const eng_novel_study_1: Topic = topicSchema.parse(eng_novel_study_1_json);
const eng_nonfiction_1: Topic = topicSchema.parse(eng_nonfiction_1_json);
const eng_media_visual_literacy: Topic = topicSchema.parse(eng_media_visual_literacy_json);
const eng_drama_shakespeare: Topic = topicSchema.parse(eng_drama_shakespeare_json);
const eng_yr8_modern_drama: Topic = topicSchema.parse(eng_yr8_modern_drama_json);
const eng_poetry_1: Topic = topicSchema.parse(eng_poetry_1_json);
const eng_poetry_2: Topic = topicSchema.parse(eng_poetry_2_json);
const eng_critical_reading_1: Topic = topicSchema.parse(eng_critical_reading_1_json);
const eng_yr9_close_reading: Topic = topicSchema.parse(eng_yr9_close_reading_json);
const eng_yr9_war_poetry: Topic = topicSchema.parse(eng_yr9_war_poetry_json);
const eng_creative_1: Topic = topicSchema.parse(eng_creative_1_json);
const eng_yr7_identity_autobiography: Topic = topicSchema.parse(eng_yr7_identity_autobiography_json);
const eng_narrative_1: Topic = topicSchema.parse(eng_narrative_1_json);
const eng_yr8_short_story_writing: Topic = topicSchema.parse(eng_yr8_short_story_writing_json);
const eng_yr9_descriptive_writing: Topic = topicSchema.parse(eng_yr9_descriptive_writing_json);
const eng_creative_2: Topic = topicSchema.parse(eng_creative_2_json);
const eng_persuasive_1: Topic = topicSchema.parse(eng_persuasive_1_json);
const eng_nonfiction_writing_1: Topic = topicSchema.parse(eng_nonfiction_writing_1_json);
const eng_yr9_letters_interviews: Topic = topicSchema.parse(eng_yr9_letters_interviews_json);
const eng_essay_1: Topic = topicSchema.parse(eng_essay_1_json);
const eng_essay_2: Topic = topicSchema.parse(eng_essay_2_json);
const eng_poetry_writing_1: Topic = topicSchema.parse(eng_poetry_writing_1_json);
const eng_spelling_1: Topic = topicSchema.parse(eng_spelling_1_json);
const eng_grammar_1: Topic = topicSchema.parse(eng_grammar_1_json);
const eng_grammar_2: Topic = topicSchema.parse(eng_grammar_2_json);
const eng_punctuation_1: Topic = topicSchema.parse(eng_punctuation_1_json);
const eng_speaking_1: Topic = topicSchema.parse(eng_speaking_1_json);
const eng_spoken_language_1: Topic = topicSchema.parse(eng_spoken_language_1_json);
const eng_persuasive_speaking_1: Topic = topicSchema.parse(eng_persuasive_speaking_1_json);
const bio_practical_1: Topic = topicSchema.parse(bio_practical_1_json);
const bio_cell_1: Topic = topicSchema.parse(bio_cell_1_json);
const bio_body_1: Topic = topicSchema.parse(bio_body_1_json);
const bio_nutrition_1: Topic = topicSchema.parse(bio_nutrition_1_json);
const bio_photosynthesis_1: Topic = topicSchema.parse(bio_photosynthesis_1_json);
const bio_respiration_1: Topic = topicSchema.parse(bio_respiration_1_json);
const bio_plants_1: Topic = topicSchema.parse(bio_plants_1_json);
const bio_health_1: Topic = topicSchema.parse(bio_health_1_json);
const bio_human_reproduction_1: Topic = topicSchema.parse(bio_human_reproduction_1_json);
const bio_classification_1: Topic = topicSchema.parse(bio_classification_1_json);
const bio_genetics_1: Topic = topicSchema.parse(bio_genetics_1_json);
const bio_ecology_1: Topic = topicSchema.parse(bio_ecology_1_json);
const bio_microorganisms_1: Topic = topicSchema.parse(bio_microorganisms_1_json);
const bio_reproduction_1: Topic = topicSchema.parse(bio_reproduction_1_json);
const chem_working_scientifically_1: Topic = topicSchema.parse(chem_working_scientifically_1_json);
const chem_states_1: Topic = topicSchema.parse(chem_states_1_json);
const chem_mixtures_1: Topic = topicSchema.parse(chem_mixtures_1_json);
const chem_acids_1: Topic = topicSchema.parse(chem_acids_1_json);
const chem_changes_1: Topic = topicSchema.parse(chem_changes_1_json);
const chem_periodic_1: Topic = topicSchema.parse(chem_periodic_1_json);
const chem_metals_1: Topic = topicSchema.parse(chem_metals_1_json);
const chem_atomic_1: Topic = topicSchema.parse(chem_atomic_1_json);
const chem_bonding_1: Topic = topicSchema.parse(chem_bonding_1_json);
const chem_rates_1: Topic = topicSchema.parse(chem_rates_1_json);
const chem_organic_1: Topic = topicSchema.parse(chem_organic_1_json);
const chem_ion_tests_1: Topic = topicSchema.parse(chem_ion_tests_1_json);
const chem_earth_1: Topic = topicSchema.parse(chem_earth_1_json);
const phys_working_scientifically_1: Topic = topicSchema.parse(phys_working_scientifically_1_json);
const phys_energy_1: Topic = topicSchema.parse(phys_energy_1_json);
const phys_forces_1: Topic = topicSchema.parse(phys_forces_1_json);
const phys_forces_action_1: Topic = topicSchema.parse(phys_forces_action_1_json);
const phys_waves_1: Topic = topicSchema.parse(phys_waves_1_json);
const phys_light_1: Topic = topicSchema.parse(phys_light_1_json);
const phys_magnetism_1: Topic = topicSchema.parse(phys_magnetism_1_json);
const phys_space_1: Topic = topicSchema.parse(phys_space_1_json);
const phys_particles_1: Topic = topicSchema.parse(phys_particles_1_json);
const phys_electricity_1: Topic = topicSchema.parse(phys_electricity_1_json);
const phys_pressure_1: Topic = topicSchema.parse(phys_pressure_1_json);
const phys_simple_machines_1: Topic = topicSchema.parse(phys_simple_machines_1_json);
const phys_radioactivity_1: Topic = topicSchema.parse(phys_radioactivity_1_json);
const phys_energy_resources_1: Topic = topicSchema.parse(phys_energy_resources_1_json);
const geo_yr7_what_is_geography: Topic = topicSchema.parse(geo_yr7_what_is_geography_json);
const geo_yr7_weather_climate_intro: Topic = topicSchema.parse(geo_yr7_weather_climate_intro_json);
const geo_yr7_rivers_landforms: Topic = topicSchema.parse(geo_yr7_rivers_landforms_json);
const geo_yr7_population_urban: Topic = topicSchema.parse(geo_yr7_population_urban_json);
const geo_yr8_plate_tectonics: Topic = topicSchema.parse(geo_yr8_plate_tectonics_json);
const geo_yr8_world_climates_biomes: Topic = topicSchema.parse(geo_yr8_world_climates_biomes_json);
const geo_yr8_climate_change: Topic = topicSchema.parse(geo_yr8_climate_change_json);
const geo_yr9_development: Topic = topicSchema.parse(geo_yr9_development_json);
const geo_yr9_migration_globalisation: Topic = topicSchema.parse(geo_yr9_migration_globalisation_json);
const geo_yr9_urbanisation_sustainable_cities: Topic = topicSchema.parse(geo_yr9_urbanisation_sustainable_cities_json);
const hist_yr7_intro_history_skills: Topic = topicSchema.parse(hist_yr7_intro_history_skills_json);
const hist_yr7_medieval_china: Topic = topicSchema.parse(hist_yr7_medieval_china_json);
const hist_yr7_medieval_europe: Topic = topicSchema.parse(hist_yr7_medieval_europe_json);
const hist_yr8_ww1: Topic = topicSchema.parse(hist_yr8_ww1_json);
const hist_yr8_russian_revolution: Topic = topicSchema.parse(hist_yr8_russian_revolution_json);
const hist_yr8_india_independence_partition: Topic = topicSchema.parse(hist_yr8_india_independence_partition_json);
const hist_yr9_weimar_nazi_rise: Topic = topicSchema.parse(hist_yr9_weimar_nazi_rise_json);
const hist_yr9_nazi_germany: Topic = topicSchema.parse(hist_yr9_nazi_germany_json);
const hist_yr9_ww2_europe: Topic = topicSchema.parse(hist_yr9_ww2_europe_json);
const hist_yr9_ww2_asia: Topic = topicSchema.parse(hist_yr9_ww2_asia_json);
const hist_yr9_holocaust: Topic = topicSchema.parse(hist_yr9_holocaust_json);
const ict_yr7_scratch_stem: Topic = topicSchema.parse(ict_yr7_scratch_stem_json);
const ict_yr7_python_basics: Topic = topicSchema.parse(ict_yr7_python_basics_json);
const ict_yr7_spreadsheets: Topic = topicSchema.parse(ict_yr7_spreadsheets_json);
const ict_yr7_image_editing: Topic = topicSchema.parse(ict_yr7_image_editing_json);
const ict_yr7_web_html_css: Topic = topicSchema.parse(ict_yr7_web_html_css_json);
const ict_yr8_python_next: Topic = topicSchema.parse(ict_yr8_python_next_json);
const ict_yr8_animation: Topic = topicSchema.parse(ict_yr8_animation_json);
const ict_yr8_3d_design: Topic = topicSchema.parse(ict_yr8_3d_design_json);
const ict_yr9_microprocessors: Topic = topicSchema.parse(ict_yr9_microprocessors_json);
const ict_yr9_python_projects: Topic = topicSchema.parse(ict_yr9_python_projects_json);
const ict_yr9_video_production: Topic = topicSchema.parse(ict_yr9_video_production_json);
const ict_yr9_understanding_ai: Topic = topicSchema.parse(ict_yr9_understanding_ai_json);
const chin_yr7_pinyin_tones_characters: Topic = topicSchema.parse(chin_yr7_pinyin_tones_characters_json);
const chin_yr7_greetings_names: Topic = topicSchema.parse(chin_yr7_greetings_names_json);
const chin_yr7_numbers_dates_time: Topic = topicSchema.parse(chin_yr7_numbers_dates_time_json);
const chin_yr7_family_pets: Topic = topicSchema.parse(chin_yr7_family_pets_json);
const chin_yr7_food_meals: Topic = topicSchema.parse(chin_yr7_food_meals_json);
const chin_yr7_colours_clothes: Topic = topicSchema.parse(chin_yr7_colours_clothes_json);
const chin_yr8_home_rooms: Topic = topicSchema.parse(chin_yr8_home_rooms_json);
const chin_yr8_hobbies_daily_routine: Topic = topicSchema.parse(chin_yr8_hobbies_daily_routine_json);
const chin_yr8_school_life: Topic = topicSchema.parse(chin_yr8_school_life_json);
const chin_yr8_weather_seasons: Topic = topicSchema.parse(chin_yr8_weather_seasons_json);
const chin_yr8_fairy_tales_fables: Topic = topicSchema.parse(chin_yr8_fairy_tales_fables_json);
const chin_yr8_idioms_chengyu: Topic = topicSchema.parse(chin_yr8_idioms_chengyu_json);
const chin_yr9_body_health: Topic = topicSchema.parse(chin_yr9_body_health_json);
const chin_yr9_places_directions: Topic = topicSchema.parse(chin_yr9_places_directions_json);
const chin_yr9_shopping_gifts: Topic = topicSchema.parse(chin_yr9_shopping_gifts_json);
const chin_yr9_festivals_celebrations: Topic = topicSchema.parse(chin_yr9_festivals_celebrations_json);
const chin_yr9_myths_legends: Topic = topicSchema.parse(chin_yr9_myths_legends_json);
const chin_yr9_culture_inventions: Topic = topicSchema.parse(chin_yr9_culture_inventions_json);
const chin_yr9_descriptive_scenery_texts: Topic = topicSchema.parse(chin_yr9_descriptive_scenery_texts_json);
const chin_yr9_poetry: Topic = topicSchema.parse(chin_yr9_poetry_json);
const germ_yr7_greetings_basics: Topic = topicSchema.parse(germ_yr7_greetings_basics_json);
const germ_yr7_family_home: Topic = topicSchema.parse(germ_yr7_family_home_json);
const germ_yr7_freetime_hobbies: Topic = topicSchema.parse(germ_yr7_freetime_hobbies_json);
const germ_yr7_school_life: Topic = topicSchema.parse(germ_yr7_school_life_json);
const germ_yr7_animals_colours: Topic = topicSchema.parse(germ_yr7_animals_colours_json);
const germ_yr8_feelings_friendship: Topic = topicSchema.parse(germ_yr8_feelings_friendship_json);
const germ_yr8_food_drink: Topic = topicSchema.parse(germ_yr8_food_drink_json);
const germ_yr8_shopping_clothes: Topic = topicSchema.parse(germ_yr8_shopping_clothes_json);
const germ_yr8_town_directions: Topic = topicSchema.parse(germ_yr8_town_directions_json);
const germ_yr8_travel_places: Topic = topicSchema.parse(germ_yr8_travel_places_json);
const germ_yr9_housing_rooms: Topic = topicSchema.parse(germ_yr9_housing_rooms_json);
const germ_yr9_celebrations_health: Topic = topicSchema.parse(germ_yr9_celebrations_health_json);
const germ_yr9_jobs_professions: Topic = topicSchema.parse(germ_yr9_jobs_professions_json);

const bio_ks3_bio_ks3_set_1: Paper = paperSchema.parse(bio_ks3_bio_ks3_set_1_json);
const bio_ks3_bio_ks3_set_2: Paper = paperSchema.parse(bio_ks3_bio_ks3_set_2_json);
const chem_ks3_chem_ks3_set_1: Paper = paperSchema.parse(chem_ks3_chem_ks3_set_1_json);
const chem_ks3_chem_ks3_set_2: Paper = paperSchema.parse(chem_ks3_chem_ks3_set_2_json);
const chin_ks3_chin_ks3_set_1: Paper = paperSchema.parse(chin_ks3_chin_ks3_set_1_json);
const chin_ks3_chin_ks3_set_2: Paper = paperSchema.parse(chin_ks3_chin_ks3_set_2_json);
const eng_ks3_eng_ks3_set_1: Paper = paperSchema.parse(eng_ks3_eng_ks3_set_1_json);
const eng_ks3_eng_ks3_set_2: Paper = paperSchema.parse(eng_ks3_eng_ks3_set_2_json);
const geog_ks3_geog_ks3_set_1: Paper = paperSchema.parse(geog_ks3_geog_ks3_set_1_json);
const geog_ks3_geog_ks3_set_2: Paper = paperSchema.parse(geog_ks3_geog_ks3_set_2_json);
const germ_ks3_germ_ks3_set_1: Paper = paperSchema.parse(germ_ks3_germ_ks3_set_1_json);
const germ_ks3_germ_ks3_set_2: Paper = paperSchema.parse(germ_ks3_germ_ks3_set_2_json);
const hist_ks3_hist_ks3_set_1: Paper = paperSchema.parse(hist_ks3_hist_ks3_set_1_json);
const hist_ks3_hist_ks3_set_2: Paper = paperSchema.parse(hist_ks3_hist_ks3_set_2_json);
const ict_ks3_ict_ks3_set_1: Paper = paperSchema.parse(ict_ks3_ict_ks3_set_1_json);
const ict_ks3_ict_ks3_set_2: Paper = paperSchema.parse(ict_ks3_ict_ks3_set_2_json);
const math_dp_ai_math_dp_ai_set_1: Paper = paperSchema.parse(math_dp_ai_math_dp_ai_set_1_json);
const math_dp_ai_math_dp_ai_set_2: Paper = paperSchema.parse(math_dp_ai_math_dp_ai_set_2_json);
const math_y7_math_y7_set_1: Paper = paperSchema.parse(math_y7_math_y7_set_1_json);
const math_y7_math_y7_set_2: Paper = paperSchema.parse(math_y7_math_y7_set_2_json);
const math_y8_math_y8_set_1: Paper = paperSchema.parse(math_y8_math_y8_set_1_json);
const math_y8_math_y8_set_2: Paper = paperSchema.parse(math_y8_math_y8_set_2_json);
const math_y9_math_y9_set_1: Paper = paperSchema.parse(math_y9_math_y9_set_1_json);
const math_y9_math_y9_set_2: Paper = paperSchema.parse(math_y9_math_y9_set_2_json);
const phys_ks3_phys_ks3_set_1: Paper = paperSchema.parse(phys_ks3_phys_ks3_set_1_json);
const phys_ks3_phys_ks3_set_2: Paper = paperSchema.parse(phys_ks3_phys_ks3_set_2_json);

const validatedSubjectsMeta = subjectMetaSchema.array().parse(subjectsMeta);

const mathMeta = validatedSubjectsMeta.find((s) => s.id === 'math')!;
const englishMeta = validatedSubjectsMeta.find((s) => s.id === 'english')!;
const biologyMeta = validatedSubjectsMeta.find((s) => s.id === 'biology')!;
const chemistryMeta = validatedSubjectsMeta.find((s) => s.id === 'chemistry')!;
const physicsMeta = validatedSubjectsMeta.find((s) => s.id === 'physics')!;
const geographyMeta = validatedSubjectsMeta.find((s) => s.id === 'geography')!;
const historyMeta = validatedSubjectsMeta.find((s) => s.id === 'history')!;
const ictMeta = validatedSubjectsMeta.find((s) => s.id === 'ict')!;
const chineseMeta = validatedSubjectsMeta.find((s) => s.id === 'chinese')!;
const germanMeta = validatedSubjectsMeta.find((s) => s.id === 'german')!;

const mathSubject: Subject = {
  id: mathMeta.id as SubjectId,
  name: mathMeta.name,
  icon: mathMeta.icon,
  accentColor: mathMeta.accentColor,
  topics: [math_yr7_calculations, math_yr7_negative_numbers, math_yr7_factors_multiples, math_yr7_rounding_estimation, math_fractions_1, math_yr7_decimals, math_yr7_percentages, math_yr7_number_bases, math_yr7_money_finance, math_algebra_1, math_yr7_substitution, math_yr7_algebraic_expressions, math_yr7_equations, math_yr7_sequences, math_yr7_measures_conversions, math_yr7_angles, math_geometry_1, math_yr7_area_perimeter, math_yr7_nets_3d_shapes, math_yr7_volume_surface_area, math_yr7_transformations, math_yr7_constructions_loci, math_yr7_bearings_scale, math_yr7_data, math_yr7_probability, math_yr7_venn_sets, math_statistics_1, math_yr8_standard_form, math_yr8_percentages_ratio_proportion, math_yr8_sequences, math_yr8_factorising, math_yr8_linear_equations, math_yr8_straight_line_graphs, math_yr8_angles_parallel_polygons, math_yr8_circles, math_yr8_transformations, math_yr8_congruence_similarity, math_yr8_pythagoras, math_yr8_volume_surface_area, math_yr8_compound_measures, math_yr8_statistics_averages, math_yr8_probability_trees, math_powers_myp, math_yr9_standard_form, math_yr9_surds, math_yr9_error_intervals, math_ratio_myp, math_linear_myp, math_inequalities_myp, math_simultaneous_myp, math_yr9_quadratic_expressions, math_yr9_quadratic_graphs, math_yr9_3d_geometry, math_pythagoras_myp, math_trig_basic_myp, math_yr9_scatter_graphs, math_dp_ai_sequences, math_dp_ai_exponents, math_dp_ai_binomial, math_dp_ai_functions, math_dp_ai_quadratics, math_dp_ai_explog, math_dp_ai_trig, math_dp_ai_vectors, math_dp_ai_voronoi_diagrams, math_dp_ai_descriptive_statistics, math_dp_ai_probability, math_dp_ai_correlation_regression, math_dp_ai_hypothesis_testing, math_dp_ai_differentiation, math_dp_ai_integration, math_dp_ai_kinematics, math_dp_ai_complex_numbers, math_dp_ai_matrices, math_dp_ai_graph_theory, math_dp_ai_poisson_distribution],
};
const englishSubject: Subject = {
  id: englishMeta.id as SubjectId,
  name: englishMeta.name,
  icon: englishMeta.icon,
  accentColor: englishMeta.accentColor,
  topics: [eng_reading_1, eng_figurative_1, eng_myths_legends, eng_yr7_graphic_novels, eng_yr7_short_story, eng_novel_study_1, eng_nonfiction_1, eng_media_visual_literacy, eng_drama_shakespeare, eng_yr8_modern_drama, eng_poetry_1, eng_poetry_2, eng_critical_reading_1, eng_yr9_close_reading, eng_yr9_war_poetry, eng_creative_1, eng_yr7_identity_autobiography, eng_narrative_1, eng_yr8_short_story_writing, eng_yr9_descriptive_writing, eng_creative_2, eng_persuasive_1, eng_nonfiction_writing_1, eng_yr9_letters_interviews, eng_essay_1, eng_essay_2, eng_poetry_writing_1, eng_spelling_1, eng_grammar_1, eng_grammar_2, eng_punctuation_1, eng_speaking_1, eng_spoken_language_1, eng_persuasive_speaking_1],
};
const biologySubject: Subject = {
  id: biologyMeta.id as SubjectId,
  name: biologyMeta.name,
  icon: biologyMeta.icon,
  accentColor: biologyMeta.accentColor,
  topics: [bio_practical_1, bio_cell_1, bio_body_1, bio_nutrition_1, bio_photosynthesis_1, bio_respiration_1, bio_plants_1, bio_health_1, bio_human_reproduction_1, bio_classification_1, bio_genetics_1, bio_ecology_1, bio_microorganisms_1, bio_reproduction_1],
};
const chemistrySubject: Subject = {
  id: chemistryMeta.id as SubjectId,
  name: chemistryMeta.name,
  icon: chemistryMeta.icon,
  accentColor: chemistryMeta.accentColor,
  topics: [chem_working_scientifically_1, chem_states_1, chem_mixtures_1, chem_acids_1, chem_changes_1, chem_periodic_1, chem_metals_1, chem_atomic_1, chem_bonding_1, chem_rates_1, chem_organic_1, chem_ion_tests_1, chem_earth_1],
};
const physicsSubject: Subject = {
  id: physicsMeta.id as SubjectId,
  name: physicsMeta.name,
  icon: physicsMeta.icon,
  accentColor: physicsMeta.accentColor,
  topics: [phys_working_scientifically_1, phys_energy_1, phys_forces_1, phys_forces_action_1, phys_waves_1, phys_light_1, phys_magnetism_1, phys_space_1, phys_particles_1, phys_electricity_1, phys_pressure_1, phys_simple_machines_1, phys_radioactivity_1, phys_energy_resources_1],
};
const geographySubject: Subject = {
  id: geographyMeta.id as SubjectId,
  name: geographyMeta.name,
  icon: geographyMeta.icon,
  accentColor: geographyMeta.accentColor,
  topics: [geo_yr7_what_is_geography, geo_yr7_weather_climate_intro, geo_yr7_rivers_landforms, geo_yr7_population_urban, geo_yr8_plate_tectonics, geo_yr8_world_climates_biomes, geo_yr8_climate_change, geo_yr9_development, geo_yr9_migration_globalisation, geo_yr9_urbanisation_sustainable_cities],
};
const historySubject: Subject = {
  id: historyMeta.id as SubjectId,
  name: historyMeta.name,
  icon: historyMeta.icon,
  accentColor: historyMeta.accentColor,
  topics: [hist_yr7_intro_history_skills, hist_yr7_medieval_china, hist_yr7_medieval_europe, hist_yr8_ww1, hist_yr8_russian_revolution, hist_yr8_india_independence_partition, hist_yr9_weimar_nazi_rise, hist_yr9_nazi_germany, hist_yr9_ww2_europe, hist_yr9_ww2_asia, hist_yr9_holocaust],
};
const ictSubject: Subject = {
  id: ictMeta.id as SubjectId,
  name: ictMeta.name,
  icon: ictMeta.icon,
  accentColor: ictMeta.accentColor,
  topics: [ict_yr7_scratch_stem, ict_yr7_python_basics, ict_yr7_spreadsheets, ict_yr7_image_editing, ict_yr7_web_html_css, ict_yr8_python_next, ict_yr8_animation, ict_yr8_3d_design, ict_yr9_microprocessors, ict_yr9_python_projects, ict_yr9_video_production, ict_yr9_understanding_ai],
};
const chineseSubject: Subject = {
  id: chineseMeta.id as SubjectId,
  name: chineseMeta.name,
  icon: chineseMeta.icon,
  accentColor: chineseMeta.accentColor,
  topics: [chin_yr7_pinyin_tones_characters, chin_yr7_greetings_names, chin_yr7_numbers_dates_time, chin_yr7_family_pets, chin_yr7_food_meals, chin_yr7_colours_clothes, chin_yr8_home_rooms, chin_yr8_hobbies_daily_routine, chin_yr8_school_life, chin_yr8_weather_seasons, chin_yr8_fairy_tales_fables, chin_yr8_idioms_chengyu, chin_yr9_body_health, chin_yr9_places_directions, chin_yr9_shopping_gifts, chin_yr9_festivals_celebrations, chin_yr9_myths_legends, chin_yr9_culture_inventions, chin_yr9_descriptive_scenery_texts, chin_yr9_poetry],
};
const germanSubject: Subject = {
  id: germanMeta.id as SubjectId,
  name: germanMeta.name,
  icon: germanMeta.icon,
  accentColor: germanMeta.accentColor,
  topics: [germ_yr7_greetings_basics, germ_yr7_family_home, germ_yr7_freetime_hobbies, germ_yr7_school_life, germ_yr7_animals_colours, germ_yr8_feelings_friendship, germ_yr8_food_drink, germ_yr8_shopping_clothes, germ_yr8_town_directions, germ_yr8_travel_places, germ_yr9_housing_rooms, germ_yr9_celebrations_health, germ_yr9_jobs_professions],
};

const subjects: Partial<Record<SubjectId, Subject>> = {
  math: mathSubject,
  english: englishSubject,
  biology: biologySubject,
  chemistry: chemistrySubject,
  physics: physicsSubject,
  geography: geographySubject,
  history: historySubject,
  ict: ictSubject,
  chinese: chineseSubject,
  german: germanSubject,
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

export const subjectMeta: Partial<Record<SubjectId, { name: string; icon: string; color: string }>> = {
  math: { name: mathMeta.name, icon: mathMeta.icon, color: mathMeta.accentColor },
  english: { name: englishMeta.name, icon: englishMeta.icon, color: englishMeta.accentColor },
  biology: { name: biologyMeta.name, icon: biologyMeta.icon, color: biologyMeta.accentColor },
  chemistry: { name: chemistryMeta.name, icon: chemistryMeta.icon, color: chemistryMeta.accentColor },
  physics: { name: physicsMeta.name, icon: physicsMeta.icon, color: physicsMeta.accentColor },
  geography: { name: geographyMeta.name, icon: geographyMeta.icon, color: geographyMeta.accentColor },
  history: { name: historyMeta.name, icon: historyMeta.icon, color: historyMeta.accentColor },
  ict: { name: ictMeta.name, icon: ictMeta.icon, color: ictMeta.accentColor },
  chinese: { name: chineseMeta.name, icon: chineseMeta.icon, color: chineseMeta.accentColor },
  german: { name: germanMeta.name, icon: germanMeta.icon, color: germanMeta.accentColor },
};

const papers: Paper[] = [bio_ks3_bio_ks3_set_1, bio_ks3_bio_ks3_set_2, chem_ks3_chem_ks3_set_1, chem_ks3_chem_ks3_set_2, chin_ks3_chin_ks3_set_1, chin_ks3_chin_ks3_set_2, eng_ks3_eng_ks3_set_1, eng_ks3_eng_ks3_set_2, geog_ks3_geog_ks3_set_1, geog_ks3_geog_ks3_set_2, germ_ks3_germ_ks3_set_1, germ_ks3_germ_ks3_set_2, hist_ks3_hist_ks3_set_1, hist_ks3_hist_ks3_set_2, ict_ks3_ict_ks3_set_1, ict_ks3_ict_ks3_set_2, math_dp_ai_math_dp_ai_set_1, math_dp_ai_math_dp_ai_set_2, math_y7_math_y7_set_1, math_y7_math_y7_set_2, math_y8_math_y8_set_1, math_y8_math_y8_set_2, math_y9_math_y9_set_1, math_y9_math_y9_set_2, phys_ks3_phys_ks3_set_1, phys_ks3_phys_ks3_set_2];

export function getAllPapers(): Paper[] {
  return papers;
}

export function getPapersForCourse(courseId: string): Paper[] {
  return papers.filter((p) => p.courseId === courseId);
}

export function getPaper(courseId: string, paperId: string): Paper | undefined {
  return papers.find((p) => p.id === paperId && p.courseId === courseId);
}
