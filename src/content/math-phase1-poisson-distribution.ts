import { Topic } from './types';

const mathDpPoissonDistribution: Topic = {
  id: 'math-dp-poisson-distribution',
  subjectId: 'math',
  title: 'Poisson Distribution',
  description: 'Modelling rare events with the Poisson distribution, calculating probabilities, and using its unique mean = variance property.',
  ibLevel: 'DP',
  notes: [
    {
      id: 'math-dp-poisson-distribution-n1',
      heading: 'What is a Poisson Distribution?',
      body: 'A Poisson distribution is a discrete probability distribution that models the number of occurrences of an event in a fixed time period or space. A random variable X follows a Poisson distribution, written X ~ Po(m), if it counts occurrences that satisfy two conditions: occurrences are independent, and they occur at a uniform average rate m. For example, the number of emails received in an hour, cars passing a camera in 10 minutes, or flaws in a sheet of glass can all be modelled this way. Unlike the binomial distribution, there is no fixed number of trials — events can theoretically keep happening forever.',
    },
    {
      id: 'math-dp-poisson-distribution-n2',
      heading: 'The Poisson Formula and Key Properties',
      body: 'The probability of exactly r occurrences is P(X = r) = e^(−m) · m^r / r!, where e ≈ 2.718 and r! = r×(r−1)×…×2×1 (with 0! = 1). The most remarkable property is that the mean and variance are both equal to m: E(X) = m and Var(X) = m. This means the standard deviation is √m. If you ever see a discrete variable where the sample mean roughly equals the sample variance, a Poisson model might fit. Another powerful property: if X ~ Po(m) and Y ~ Po(λ) are independent, then X + Y ~ Po(m + λ). This extends to any number of independent Poisson variables.',
    },
    {
      id: 'math-dp-poisson-distribution-n3',
      heading: 'Calculating Poisson Probabilities',
      body: 'Use your GDC to find Poisson probabilities efficiently. For a single value, use Poisson PD (pdf): P(X = x). For cumulative probabilities, use Poisson CD (cdf): P(X ≤ x). To handle inequalities, rewrite them using cdf results: P(X < x) = P(X ≤ x − 1), P(X > x) = 1 − P(X ≤ x), and P(X ≥ x) = 1 − P(X ≤ x − 1). For a range: P(a ≤ X ≤ b) = P(X ≤ b) − P(X ≤ a − 1). Always remember that X must be a non-negative integer; for a discrete distribution, strict inequalities (< and >) differ from weak ones (≤ and ≥) by exactly one integer.',
    },
    {
      id: 'math-dp-poisson-distribution-n4',
      heading: 'Modelling with the Poisson Distribution',
      body: 'To set up a Poisson model, first identify what counts as a single occurrence in the scenario. Next, determine the mean rate m for the relevant time period or space using proportion if necessary. For example, if 12 cars pass in 5 minutes on average, then in 15 minutes the mean would be 36. Always state your random variable clearly: "Let X be the number of calls received in a 10-minute period, so X ~ Po(m)." Check that the conditions hold: events must be independent and occur at a constant average rate. If either condition fails — for instance, if occurrences tend to cluster or one event triggers another — the Poisson model is inappropriate.',
    },
  ],
  flashcards: [
    {
      id: 'math-dp-poisson-distribution-f1',
      term: 'Poisson distribution',
      definition: 'A discrete distribution modelling the number of occurrences in a fixed interval when events are independent and occur at a constant average rate.',
      example: 'X ~ Po(4) where X = number of customer arrivals per hour.',
    },
    {
      id: 'math-dp-poisson-distribution-f2',
      term: 'Conditions for a Poisson model',
      definition: 'Occurrences must be independent and occur at a uniform average rate for the interval.',
      example: 'Phone calls to a switchboard — each call is independent and arrives at a steady average rate.',
    },
    {
      id: 'math-dp-poisson-distribution-f3',
      term: 'Poisson probability formula',
      definition: 'P(X = r) = e^(−m) · m^r / r! for r = 0, 1, 2, ...',
      example: 'For X ~ Po(3): P(X = 2) = e^(−3) · 9 / 2 ≈ 0.224.',
    },
    {
      id: 'math-dp-poisson-distribution-f4',
      term: 'Mean and variance of Poisson',
      definition: 'For X ~ Po(m): E(X) = m and Var(X) = m. The standard deviation is √m.',
      example: 'If X ~ Po(9), then E(X) = 9 and SD(X) = 3.',
    },
    {
      id: 'math-dp-poisson-distribution-f5',
      term: 'Sum of independent Poisson variables',
      definition: 'If X ~ Po(m) and Y ~ Po(λ) are independent, then X + Y ~ Po(m + λ).',
      example: 'Cars ~ Po(5) and buses ~ Po(2) independently → total vehicles ~ Po(7).',
    },
    {
      id: 'math-dp-poisson-distribution-f6',
      term: 'Calculating P(X > x)',
      definition: 'P(X > x) = 1 − P(X ≤ x). Use the cumulative distribution function on your GDC.',
      example: 'P(X > 3) = 1 − P(X ≤ 3) for a Poisson variable.',
    },
    {
      id: 'math-dp-poisson-distribution-f7',
      term: 'Calculating P(a ≤ X ≤ b)',
      definition: 'P(a ≤ X ≤ b) = P(X ≤ b) − P(X ≤ a − 1).',
      example: 'P(2 ≤ X ≤ 5) = P(X ≤ 5) − P(X ≤ 1).',
    },
    {
      id: 'math-dp-poisson-distribution-f8',
      term: 'Scaling the mean rate',
      definition: 'Use proportion to adjust m for different time periods or areas.',
      example: '8 flaws per m² → 24 flaws per 3 m² (m scales linearly with space or time).',
    },
  ],
  questions: [
    {
      id: 'math-dp-poisson-distribution-q1',
      stem: 'For X ~ Po(2.5), what is P(X = 3) to 3 significant figures?',
      choices: ['0.114', '0.214', '0.256', '0.314'],
      correctIndex: 1,
      explanation: 'P(X = 3) = e^(−2.5) · 2.5³ / 3! = e^(−2.5) · 15.625 / 6 ≈ 0.2138 → 0.214.',
    },
    {
      id: 'math-dp-poisson-distribution-q2',
      stem: 'X ~ Po(4). What is P(X ≤ 2)?',
      choices: ['0.0916', '0.143', '0.238', '0.195'],
      correctIndex: 2,
      explanation: 'Using Poisson CD: P(X ≤ 2) = P(0) + P(1) + P(2) = e^(−4)(1 + 4 + 8) = 13e^(−4) ≈ 0.238.',
    },
    {
      id: 'math-dp-poisson-distribution-q3',
      stem: 'X ~ Po(3). What is P(X > 1)?',
      choices: ['0.050', '0.199', '0.801', '0.950'],
      correctIndex: 2,
      explanation: 'P(X > 1) = 1 − P(X ≤ 1) = 1 − [e^(−3)(1 + 3)] = 1 − 4e^(−3) ≈ 1 − 0.199 = 0.801.',
    },
    {
      id: 'math-dp-poisson-distribution-q4',
      stem: 'A discrete random variable has mean 6 and variance 6. Which distribution might model it?',
      choices: ['B(12, 0.5)', 'B(6, 1)', 'Po(6)', 'N(6, 6)'],
      correctIndex: 2,
      explanation: 'The Poisson distribution is the only one where mean = variance = m. B(12, 0.5) has mean 6 but variance 3. N(6, 6) is continuous, not discrete.',
    },
    {
      id: 'math-dp-poisson-distribution-q5',
      stem: 'X ~ Po(2) and Y ~ Po(5) are independent. What is the distribution of X + Y?',
      choices: ['Po(2)', 'Po(5)', 'Po(7)', 'Po(10)'],
      correctIndex: 2,
      explanation: 'The sum of independent Poisson variables is also Poisson with mean equal to the sum of the individual means: 2 + 5 = 7.',
    },
    {
      id: 'math-dp-poisson-distribution-q6',
      stem: 'On average, a call centre receives 8 calls in 30 minutes. Using a Poisson model, what is the mean number of calls in a 15-minute period?',
      choices: ['2', '4', '8', '16'],
      correctIndex: 1,
      explanation: 'The mean scales proportionally with time. 15 minutes is half of 30 minutes, so m = 8/2 = 4.',
    },
    {
      id: 'math-dp-poisson-distribution-q7',
      stem: 'X ~ Po(5). What is P(2 ≤ X ≤ 4)?',
      choices: ['0.175', '0.263', '0.351', '0.440'],
      correctIndex: 3,
      explanation: 'P(2 ≤ X ≤ 4) = P(X ≤ 4) − P(X ≤ 1). Using Poisson CD: P(X ≤ 4) ≈ 0.4405 and P(X ≤ 1) ≈ 0.0404. Difference ≈ 0.440.',
    },
    {
      id: 'math-dp-poisson-distribution-q8',
      stem: 'X ~ Po(1.5). What is P(X < 2)?',
      choices: ['0.105', '0.223', '0.558', '0.777'],
      correctIndex: 2,
      explanation: 'P(X < 2) = P(X ≤ 1) because X is discrete. P(X ≤ 1) = e^(−1.5)(1 + 1.5) = 2.5e^(−1.5) ≈ 0.558.',
    },
    {
      id: 'math-dp-poisson-distribution-q9',
      stem: 'Which of the following is NOT a valid reason to use a Poisson distribution?',
      choices: ['Events occur at a constant average rate', 'Events are independent', 'There is a fixed maximum number of trials', 'The mean and variance are approximately equal'],
      correctIndex: 2,
      explanation: 'Poisson does NOT require a fixed number of trials — that is a feature of the binomial distribution. Poisson events can theoretically occur without limit.',
    },
    {
      id: 'math-dp-poisson-distribution-q10',
      stem: 'X ~ Po(6). What is the standard deviation of X?',
      choices: ['√6', '6', '36', '2.45'],
      correctIndex: 0,
      explanation: 'For X ~ Po(m), Var(X) = m, so SD(X) = √m = √6. Note that 2.45 is √6 rounded, but √6 is the exact answer.',
    },
  ],
};

export default mathDpPoissonDistribution;
