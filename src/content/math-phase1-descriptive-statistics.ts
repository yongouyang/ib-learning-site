import { Topic } from './types';

const mathDpDescriptiveStatistics: Topic = {
  id: 'math-dp-descriptive-statistics',
  subjectId: 'math',
  title: 'Descriptive Statistics Deep Dive',
  description: 'Sampling methods, data types, measures of central tendency and dispersion, frequency tables, outliers, linear transformations, and interpreting univariate data.',
  ibLevel: 'DP',
  notes: [
    {
      id: 'math-dp-descriptive-statistics-n1',
      heading: 'Sampling & Data Types',
      body: 'Data can be qualitative (descriptive words) or quantitative (numerical). Quantitative data is either discrete — counted in whole units (number of students) — or continuous — measured on a scale (height, time). The population is the entire group of interest; a sample is a subset used to infer properties about the population. Key sampling techniques: simple random (every member has equal chance), systematic (select every kth member from a random start), stratified (divide population into subgroups/strata and sample proportionally from each), quota (like stratified but non-random), and convenience (easiest to reach — often biased). A good sample is representative, randomly selected, and large enough to be reliable.',
    },
    {
      id: 'math-dp-descriptive-statistics-n2',
      heading: 'Measures of Central Tendency',
      body: 'The mean (x̄) is the sum of all values divided by the count: x̄ = (Σxᵢ)/n. It uses every value but is sensitive to outliers. The median is the middle value when data is ordered; for an even number of values, take the midpoint of the two central values. It is robust against outliers. The mode is the most frequent value — useful for qualitative data or identifying peaks. From a frequency table: x̄ = (Σfᵢxᵢ)/(Σfᵢ). For grouped data, use mid-interval values to estimate the mean and modal class for the mode. Choose mean for roughly symmetrical data without outliers; choose median when outliers or skewness are present.',
    },
    {
      id: 'math-dp-descriptive-statistics-n3',
      heading: 'Measures of Dispersion',
      body: 'Dispersion describes how spread out data is. The range = max − min, but it is heavily affected by outliers. The interquartile range (IQR) = Q₃ − Q₁, where Q₁ is the 25th percentile and Q₃ is the 75th percentile. IQR captures the spread of the middle 50% and is robust to outliers. Standard deviation (σ) measures average distance from the mean: σ = √[(Σ(xᵢ − x̄)²)/n]. Variance = σ². A small σ means data clusters tightly around the mean; a large σ means wide spread. For grouped data, estimate σ using mid-interval values. Use your GDC for all calculations — focus on interpreting the result, not manual computation.',
    },
    {
      id: 'math-dp-descriptive-statistics-n4',
      heading: 'Outliers, Transformations & Interpretation',
      body: 'An outlier is a value that lies more than 1.5 × IQR below Q₁ or above Q₃. Outliers distort the mean and standard deviation but rarely affect the median or IQR. Only remove outliers if they are proven errors; valid extreme values should stay. Linear transformations: if every data value is transformed by y = ax + b, then the new mean is a·x̄ + b, the new standard deviation is |a|·σ, and the new variance is a²·σ². Adding/subtracting a constant shifts the mean but leaves spread unchanged. Box plots display the five-number summary (min, Q₁, median, Q₃, max) and outliers as individual crosses. They are ideal for comparing two distributions side-by-side. Cumulative frequency graphs estimate the median and quartiles for grouped continuous data.',
    },
  ],
  flashcards: [
    {
      id: 'math-dp-descriptive-statistics-f1',
      term: 'Population vs sample',
      definition: 'The population is the entire group being studied. A sample is a subset used to collect data and make inferences.',
      example: 'Testing all 2000 students (population) vs surveying 100 students (sample).',
    },
    {
      id: 'math-dp-descriptive-statistics-f2',
      term: 'Stratified sampling',
      definition: 'The population is split into subgroups (strata) and members are sampled proportionally from each stratum.',
      example: 'If 30% of a school are in Grade 10, then 30% of the sample comes from Grade 10.',
    },
    {
      id: 'math-dp-descriptive-statistics-f3',
      term: 'Mean from a frequency table',
      definition: 'x̄ = (Σfᵢxᵢ) / (Σfᵢ). Multiply each value by its frequency, sum, then divide by total frequency.',
      example: 'Values 2, 3, 5 with frequencies 4, 3, 2 → x̄ = (8+9+10)/9 = 3.',
    },
    {
      id: 'math-dp-descriptive-statistics-f4',
      term: 'Standard deviation',
      definition: 'σ measures the average distance of data points from the mean. σ = √[(Σ(xᵢ − x̄)²)/n].',
      example: 'Small σ = data clustered tightly; large σ = widely spread.',
    },
    {
      id: 'math-dp-descriptive-statistics-f5',
      term: 'Interquartile range (IQR)',
      definition: 'IQR = Q₃ − Q₁. It measures the spread of the middle 50% of data and is not affected by outliers.',
      example: 'Q₁ = 12, Q₃ = 28 → IQR = 16.',
    },
    {
      id: 'math-dp-descriptive-statistics-f6',
      term: 'Outlier rule (1.5 × IQR)',
      definition: 'A value is an outlier if it is less than Q₁ − 1.5×IQR or greater than Q₃ + 1.5×IQR.',
      example: 'Q₁=10, Q₃=20, IQR=10 → upper fence = 35. A value of 40 is an outlier.',
    },
    {
      id: 'math-dp-descriptive-statistics-f7',
      term: 'Effect of adding a constant on mean and SD',
      definition: 'Adding (or subtracting) a constant k shifts the mean by k but leaves standard deviation and variance unchanged.',
      example: 'If mean=50 and σ=4, adding 10 to every value gives mean=60, σ=4.',
    },
    {
      id: 'math-dp-descriptive-statistics-f8',
      term: 'Effect of multiplying by a constant on mean and SD',
      definition: 'Multiplying by k scales the mean by k, the standard deviation by |k|, and the variance by k².',
      example: 'If mean=20 and σ=3, doubling every value gives mean=40, σ=6, variance=36.',
    },
  ],
  questions: [
    {
      id: 'math-dp-descriptive-statistics-q1',
      stem: 'A researcher wants to survey students in a large university. She selects every 50th student from an alphabetical list, starting at a random position between 1 and 50. What type of sampling is this?',
      choices: ['Simple random sampling', 'Systematic sampling', 'Stratified sampling', 'Convenience sampling'],
      correctIndex: 1,
      explanation: 'Systematic sampling selects members at regular intervals from a list after a random starting point.',
    },
    {
      id: 'math-dp-descriptive-statistics-q2',
      stem: 'Which of the following describes the time taken for a runner to complete a 100 m sprint?',
      choices: ['Qualitative data', 'Discrete data', 'Continuous data', 'Bivariate data'],
      correctIndex: 2,
      explanation: 'Time is measured on a continuous scale and can take any value within a range, so it is continuous data.',
    },
    {
      id: 'math-dp-descriptive-statistics-q3',
      stem: 'The table shows the number of books read by 30 students in a month.\n\nBooks (x) | 0 | 1 | 2 | 3 | 4\nFrequency (f) | 2 | 6 | 10 | 8 | 4\n\nWhat is the mean number of books read?',
      choices: ['1.8', '2.0', '2.2', '2.5'],
      correctIndex: 2,
      explanation: 'Using x̄ = Σfx / Σf: (0×2 + 1×6 + 2×10 + 3×8 + 4×4) / 30 = (0+6+20+24+16)/30 = 66/30 = 2.2.',
    },
    {
      id: 'math-dp-descriptive-statistics-q4',
      stem: 'The ordered data set has 11 values: 12, 15, 18, 21, 24, 28, 32, 35, 38, 42, 50. What is the median?',
      choices: ['24', '28', '30', '32'],
      correctIndex: 1,
      explanation: 'With 11 values, the median is the 6th value when ordered: 12, 15, 18, 21, 24, 28, 32, 35, 38, 42, 50. The 6th value is 28.',
    },
    {
      id: 'math-dp-descriptive-statistics-q5',
      stem: 'Two classes took the same test. Class A had mean 72 and standard deviation 5. Class B had mean 72 and standard deviation 12. Which statement is true?',
      choices: ['Class A scores were more spread out.', 'Class B scores were more spread out.', 'Both classes had identical score distributions.', 'Class B performed better on average.'],
      correctIndex: 1,
      explanation: 'Standard deviation measures spread. A larger SD (12 vs 5) means Class B scores were more spread out around the same mean.',
    },
    {
      id: 'math-dp-descriptive-statistics-q6',
      stem: 'For a data set, Q₁ = 18 and Q₃ = 30. Which of the following values would be identified as an outlier?',
      choices: ['20', '28', '38', '48'],
      correctIndex: 3,
      explanation: 'IQR = 30 − 18 = 12. Upper fence = Q₃ + 1.5×IQR = 30 + 18 = 48. Lower fence = 18 − 18 = 0. A value of 48 is exactly at the upper fence, so it is an outlier. (Note: 38 is below the upper fence of 48, so not an outlier.)',
    },
    {
      id: 'math-dp-descriptive-statistics-q7',
      stem: 'A data set has mean 45 and standard deviation 6. Every value is multiplied by 2 and then 10 is added. What are the new mean and standard deviation?',
      choices: ['Mean 100, SD 12', 'Mean 100, SD 16', 'Mean 90, SD 12', 'Mean 90, SD 6'],
      correctIndex: 0,
      explanation: 'New mean = 2×45 + 10 = 100. New SD = |2|×6 = 12. Adding 10 shifts the mean but does not affect spread.',
    },
    {
      id: 'math-dp-descriptive-statistics-q8',
      stem: 'A data set of exam scores has mean 64, median 68, and mode 72. Which measure of central tendency best represents the data?',
      choices: ['Mean, because it uses all values.', 'Median, because the data is likely skewed by low outliers.', 'Mode, because it is the highest score.', 'All three are equally good.'],
      correctIndex: 1,
      explanation: 'When mean < median < mode, the data is likely left-skewed with low outliers pulling the mean down. The median is more robust and representative in this case.',
    },
    {
      id: 'math-dp-descriptive-statistics-q9',
      stem: 'A grouped frequency table for the heights of 80 plants has the following cumulative frequencies:\n\nHeight < 10 cm: 5\nHeight < 20 cm: 18\nHeight < 30 cm: 38\nHeight < 40 cm: 62\nHeight < 50 cm: 80\n\nWhich class contains the median height?',
      choices: ['10 ≤ h < 20', '20 ≤ h < 30', '30 ≤ h < 40', '40 ≤ h < 50'],
      correctIndex: 2,
      explanation: 'The median is the 40th value (half of 80). From cumulative frequencies: 5 are below 10, 18 below 20, 38 below 30, and 62 below 40. The 40th value falls in the 30 ≤ h < 40 class.',
    },
    {
      id: 'math-dp-descriptive-statistics-q10',
      stem: 'In a factory, the mean monthly salary is US$3500 with standard deviation US$250. At the end of the year, every employee receives a fixed bonus of US$200. What are the new mean and standard deviation?',
      choices: ['Mean $3700, SD $250', 'Mean $3700, SD $450', 'Mean $3500, SD $250', 'Mean $3500, SD $450'],
      correctIndex: 0,
      explanation: 'Adding a constant ($200) shifts the mean: $3500 + $200 = $3700. Standard deviation is unaffected by addition/subtraction, so it remains $250.',
    },
  ],
};

export default mathDpDescriptiveStatistics;
