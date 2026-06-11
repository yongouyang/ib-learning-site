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
      body: 'Before you analyse any data, you need to know what kind of data you have and how it was collected. Good sampling makes your conclusions reliable; bad sampling leads to biased results.\n\n📌 Types of Data\n\nQualitative data uses words or categories.\n• Favourite colour, type of pet, gender\n\nQuantitative data is numerical.\n• Discrete — counted in whole units (number of students, goals scored)\n• Continuous — measured on a scale (height, time, weight)\n\n📌 Population vs Sample\n\nThe population is the entire group you want to study.\nA sample is a smaller subset chosen from that population.\n\nYou use a sample when surveying the whole population is impractical.\n\n🔑 Sampling Methods\n\n1. Simple random sampling\n    Every member has an equal chance of selection.\n    Example: drawing names from a hat or using a random number generator.\n\n2. Systematic sampling\n    Select every kth member from a list after a random start.\n    Example: pick every 10th name from an alphabetical list.\n\n3. Stratified sampling\n    Split the population into subgroups (strata), then sample proportionally from each.\n    Example: if 30% of students are in Grade 10, then 30% of your sample comes from Grade 10.\n\n4. Quota sampling\n    Like stratified, but the selection within each subgroup is not random.\n    Example: interview exactly 8 boys and 8 girls — chosen conveniently.\n\n5. Convenience sampling\n    Use whoever is easiest to reach.\n    Example: asking only students in the cafeteria.\n\n💡 Worked Example — Stratified Sampling\n\nA school has 150 students across 6 classes. Mandy wants a stratified sample of 40 students.\n\n  Step 1: Find the sampling fraction\n    40 / 150 = 4/15\n\n  Step 2: Apply to each class\n    Class 7: 20 students → 20 × (4/15) ≈ 5 students\n    Class 8: 27 students → 27 × (4/15) ≈ 7 students\n    Class 9: 23 students → 23 × (4/15) ≈ 6 students\n    Class 10: 26 students → 26 × (4/15) ≈ 7 students\n    Class 11: 30 students → 30 × (4/15) = 8 students\n    Class 12: 24 students → 24 × (4/15) ≈ 6 students\n\n  Step 3: Check total\n    5 + 7 + 6 + 7 + 8 + 6 = 39 (rounding means the total may not be exact)\n\n📎 Key Points to Remember\n• A good sample is representative, randomly selected, and large enough to be reliable.\n• Simple random and stratified sampling usually give the most reliable results.\n• Convenience sampling is quick but often biased.\n\n⚠️ Common Mistake\nConfusing stratified and quota sampling. Stratified uses random selection within each stratum; quota does not. Only stratified sampling guarantees proportional representation with randomness.',
    },
    {
      id: 'math-dp-descriptive-statistics-n2',
      heading: 'Measures of Central Tendency',
      body: 'A measure of central tendency tells you where the "centre" of a data set lies. The three main measures are mean, median, and mode.\n\n📌 The Mean (Average)\n\nThe mean is the sum of all values divided by the number of values.\n\n    x̄ = (Σ xᵢ) / n\n\n    x̄ = mean\n    Σ xᵢ = sum of all data values\n    n = number of values\n\nFor a frequency table:\n\n    x̄ = (Σ fᵢxᵢ) / (Σ fᵢ)\n\n    fᵢ = frequency of each value\n    xᵢ = each data value\n\n💡 Worked Example — Mean from a Frequency Table\n\nMindy counts pieces of candy in bags:\n\n    Number of pieces | 23 | 24 | 25 | 26 | 27\n    Frequency        |  2 |  3 |  9 |  5 |  1\n\n  Step 1: Multiply each value by its frequency\n    23 × 2 = 46\n    24 × 3 = 72\n    25 × 9 = 225\n    26 × 5 = 130\n    27 × 1 = 27\n\n  Step 2: Sum the results and the frequencies\n    Σfx = 46 + 72 + 225 + 130 + 27 = 500\n    Σf = 2 + 3 + 9 + 5 + 1 = 20\n\n  Step 3: Divide\n    x̄ = 500 / 20 = 25 pieces per bag\n\n📌 The Median\n\nThe median is the middle value when data is arranged in order.\n\n• For an odd number of values: the middle one.\n• For an even number of values: the midpoint of the two central values.\n\n💡 Worked Example — Median\n\nData set: 35, 47, 49, 58, 58, 58, 66, 67, 69, 76, 79, 83, 88, 91\n\n  Step 1: Count the values\n    n = 14 (even)\n\n  Step 2: Identify the two middle values\n    7th value = 66\n    8th value = 67\n\n  Step 3: Find the midpoint\n    Median = (66 + 67) / 2 = 66.5\n\n📌 The Mode\n\nThe mode is the value that occurs most frequently.\n\n• A data set can have no mode, one mode, or several modes.\n• For grouped data, use the modal class — the class with the highest frequency.\n\n🔑 Choosing the Right Measure\n\n    Use the mean when data is roughly symmetrical with no outliers.\n    Use the median when outliers or skewness are present.\n    Use the mode for qualitative data or when you need the most common value.\n\n💡 Worked Example — Effect of Outliers on the Mean\n\nIce creams sold over 13 weeks:\n\n    146, 151, 158, 158, 161, 149, 160, 147, 158, 160, 216, 225, 238\n\n  Step 1: Find the three measures\n    Mode = 158 (most frequent)\n    Median = 158 (middle value)\n    Mean = 171.3 (sum / 13)\n\n  Step 2: Compare\n    The three large values (216, 225, 238) pull the mean up.\n    The median and mode stay at 158.\n\n  Conclusion: When outliers exist, the median is usually the better representative.\n\n📎 Key Points to Remember\n• The mean uses every value but is sensitive to outliers.\n• The median is robust against outliers.\n• For grouped data, use mid-interval values to estimate the mean.\n\n⚠️ Common Mistake\nUsing the mean for skewed data with outliers. Always check for extreme values first. If mean > median > mode, the data is right-skewed. If mean < median < mode, the data is left-skewed.',
    },
    {
      id: 'math-dp-descriptive-statistics-n3',
      heading: 'Measures of Dispersion',
      body: 'Dispersion tells you how spread out the data is. Two data sets can have the same mean but very different spreads.\n\n📌 The Range\n\n    Range = maximum value − minimum value\n\nThe range is simple but heavily affected by outliers.\n\n📌 The Interquartile Range (IQR)\n\n    IQR = Q₃ − Q₁\n\n    Q₁ = lower quartile (25th percentile)\n    Q₃ = upper quartile (75th percentile)\n\nThe IQR captures the spread of the middle 50% of data. It is robust to outliers.\n\n💡 Worked Example — Finding Q₁ and Q₃\n\nBiology exam scores (already ordered, n = 23):\n\n    18, 22, 26, 39, 45, 46, 46, 52, 54, 58, 62, 62, 62, 67, 70, 71, 75, 78, 82, 89, 91, 95, 98\n\n  Step 1: Find the median\n    Median = 12th value = 62\n\n  Step 2: Find Q₁ (lower quartile)\n    Q₁ is the median of the lower half = 6th value = 46\n\n  Step 3: Find Q₃ (upper quartile)\n    Q₃ is the median of the upper half = 18th value = 78\n\n  Step 4: Calculate IQR\n    IQR = 78 − 46 = 32\n\n📌 Standard Deviation\n\nStandard deviation (σ) measures the average distance of data points from the mean.\n\n    σ = √[(Σ(xᵢ − x̄)²) / n]\n\n    σ = standard deviation\n    xᵢ = each data value\n    x̄ = mean\n    n = number of values\n\nA small σ means data clusters tightly around the mean.\nA large σ means data is widely spread.\n\n💡 Worked Example — Interpreting Standard Deviation\n\nData set A: ice cream sales with mean 171.3 and σ = 30.8\nData set B: dice scores with mean 5.82 and σ = 2.80\n\n  Step 1: Compare σ to the mean\n    Data set A: σ = 30.8 is large relative to the mean → wide spread\n    Data set B: σ = 2.80 is small relative to the mean → clustered data\n\n  Step 2: Interpret\n    In data set A, the outliers pull values far from the mean.\n    In data set B, most scores sit close to the average.\n\n📌 Variance\n\n    Variance = σ²\n\nVariance is the square of standard deviation. It is used in advanced statistical processes like regression and probability theory.\n\n📌 Grouped Data\n\nFor grouped data, use the midpoint of each class interval as your x value. Multiply by frequency, then apply the same formulas.\n\n    Remember: these are estimates, not exact values.\n\n📎 Key Points to Remember\n• Use your GDC for all standard deviation calculations.\n• Focus on interpreting σ, not computing it by hand.\n• IQR is more reliable than range when outliers may exist.\n• Variance = σ². If σ = 3, variance = 9.\n\n⚠️ Common Mistake\nForgetting that grouped data gives estimates for mean and standard deviation. The exact values depend on the actual distribution within each class. Always state that grouped results are approximate.',
    },
    {
      id: 'math-dp-descriptive-statistics-n4',
      heading: 'Outliers, Transformations & Interpretation',
      body: 'This section brings together how to spot unusual values, how they affect your analysis, and what happens when you change every value in a data set.\n\n📌 Identifying Outliers\n\nA value is an outlier if it lies more than 1.5 × IQR below Q₁ or above Q₃.\n\n    Lower fence = Q₁ − 1.5 × IQR\n    Upper fence = Q₃ + 1.5 × IQR\n\nAny value outside these fences is an outlier.\n\n💡 Worked Example — Outlier Detection\n\nFor the biology exam data: Q₁ = 46, Q₃ = 78, IQR = 32\n\n  Step 1: Calculate the fences\n    Lower fence = 46 − 1.5 × 32 = 46 − 48 = −2\n    Upper fence = 78 + 1.5 × 32 = 78 + 48 = 126\n\n  Step 2: Check the data\n    All scores are between 18 and 98.\n\n  Conclusion: There are no outliers in this data set.\n\n📌 Effect of Outliers on Measures\n\n• Mean and standard deviation are distorted by outliers.\n• Median and IQR are usually unaffected.\n• Only remove outliers if they are proven errors. Valid extreme values should stay.\n\n📌 Linear Transformations of Data\n\nIf every data value is transformed by y = ax + b:\n\n    New mean = a × x̄ + b\n    New standard deviation = |a| × σ\n    New variance = a² × σ²\n\n    a = multiplication factor\n    b = addition/subtraction constant\n    x̄ = original mean\n    σ = original standard deviation\n\n💡 Worked Example — Transformation\n\nA data set has mean 45 and standard deviation 6. Every value is multiplied by 2, then 10 is added.\n\n  Step 1: New mean\n    Mean = 2 × 45 + 10 = 100\n\n  Step 2: New standard deviation\n    SD = |2| × 6 = 12\n\n  Step 3: New variance\n    Variance = 2² × 6² = 4 × 36 = 144\n\n  Key insight: Adding 10 shifts the mean but does not affect spread. Multiplying by 2 scales both the mean and the spread.\n\n📌 Box Plots (Box-and-Whisker Plots)\n\nA box plot displays the five-number summary:\n\n    Minimum, Q₁, Median, Q₃, Maximum\n\nOutliers are shown as individual crosses beyond the whiskers.\n\nBox plots are ideal for comparing two distributions side-by-side.\n\n📌 Cumulative Frequency Graphs\n\nA cumulative frequency graph plots upper class boundary against cumulative frequency.\n\nYou can read off:\n• Median at 50% of total frequency\n• Q₁ at 25% of total frequency\n• Q₃ at 75% of total frequency\n• Any percentile by finding the corresponding percentage\n\n💡 Worked Example — Cumulative Frequency\n\nThe table shows visitors to a castle over 200 days:\n\n    Visitors      | 0–50 | 50–100 | 100–150 | 150–200 | 200–250 | 250–300 | 300–350 | 350–400\n    Frequency     |   16 |     38 |      50 |      36 |      32 |      19 |       6 |       3\n\n  Step 1: Build cumulative frequencies\n    < 50: 16\n    < 100: 16 + 38 = 54\n    < 150: 54 + 50 = 104\n    < 200: 104 + 36 = 140\n    < 250: 140 + 32 = 172\n    < 300: 172 + 19 = 191\n    < 350: 191 + 6 = 197\n    < 400: 197 + 3 = 200\n\n  Step 2: Estimate median and quartiles from the graph\n    Median (100th value) ≈ 146\n    Q₁ (50th value) ≈ 95\n    Q₃ (150th value) ≈ 215\n\n  Step 3: Check for outliers\n    IQR = 215 − 95 = 120\n    Upper fence = 215 + 1.5 × 120 = 395\n    Lower fence = 95 − 1.5 × 120 = −85\n    Since max = 370 and min = 25, there are no outliers.\n\n📎 Key Points to Remember\n• Adding or subtracting a constant shifts the mean but leaves spread unchanged.\n• Multiplying by a constant scales the mean, standard deviation, and variance.\n• Box plots give a quick visual comparison of two data sets.\n• Cumulative frequency graphs are best for estimating percentiles in grouped continuous data.\n\n⚠️ Common Mistake\nForgetting that standard deviation scales by |a| but variance scales by a². If you double every value, the SD doubles but the variance becomes four times larger. Also, do not confuse the 1.5 × IQR rule with 3 × IQR — the IB uses 1.5.',
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
