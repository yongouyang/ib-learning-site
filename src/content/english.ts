import { Topic, Subject } from './types';

const engNarrative: Topic = {
  id: 'eng-narrative-1', subjectId: 'english', title: 'Narrative Techniques',
  description: 'How authors craft stories using perspective, structure, and voice.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'Point of View', body: 'First person uses "I/me" — feels personal. Third person limited follows one character. Third person omniscient knows all characters\' thoughts. POV shapes what the reader knows and how much they trust the narrator.' },
    { id: 'n2', heading: 'Narrative Structure', body: 'Most stories follow: exposition (setup) → rising action (conflict builds) → climax (peak tension) → falling action → resolution. This is Freytag\'s Pyramid. Some authors play with this order for suspense.' },
    { id: 'n3', heading: 'Foreshadowing and Flashback', body: 'Foreshadowing: hints early about later events. Flashback: jumps back in time to show earlier events. Both control what readers know and when.' },
  ],
  flashcards: [
    { id: 'f1', term: 'First-person narrator', definition: 'Uses "I/me" — reader only knows what this character knows.', example: '"I walked into the dark room..."' },
    { id: 'f2', term: 'Omniscient narrator', definition: 'All-knowing narrator who can describe any character\'s thoughts and feelings.', example: undefined },
    { id: 'f3', term: 'Climax', definition: 'Moment of highest tension — the turning point.', example: 'In a detective story, when the murderer is revealed.' },
    { id: 'f4', term: 'Foreshadowing', definition: 'Hints given early about events that will happen later.', example: 'A dark storm arriving as the hero sets off on a dangerous journey.' },
    { id: 'f5', term: 'Flashback', definition: 'A scene interrupting present action to show an earlier event.', example: undefined },
  ],
  questions: [
    { id: 'q1', stem: 'Which POV uses "I" and limits the reader to one character\'s perspective?', choices: ['Third person omniscient', 'Second person', 'First person', 'Third person limited'], correctIndex: 2, explanation: 'First person uses "I" and places the reader inside one character\'s mind.' },
    { id: 'q2', stem: 'The turning point of highest tension in a narrative is the:', choices: ['Resolution', 'Exposition', 'Rising action', 'Climax'], correctIndex: 3, explanation: 'Climax is the peak of the story\'s tension.' },
    { id: 'q3', stem: 'A childhood memory scene in the middle of a present-day story is a:', choices: ['Foreshadowing', 'Flashback', 'Climax', 'Resolution'], correctIndex: 1, explanation: 'A flashback interrupts current timeline to show a past scene.' },
    { id: 'q4', stem: 'A cracked bridge railing early in a story hinting at later collapse is:', choices: ['Flashback', 'Resolution', 'Foreshadowing', 'Exposition'], correctIndex: 2, explanation: 'Foreshadowing plants hints about future events.' },
    { id: 'q5', stem: 'Which stage introduces characters, setting, and initial situation?', choices: ['Climax', 'Falling action', 'Rising action', 'Exposition'], correctIndex: 3, explanation: 'Exposition sets the scene and introduces key characters.' },
  ],
};

const engFigurative: Topic = {
  id: 'eng-figurative-1', subjectId: 'english', title: 'Figurative Language',
  description: 'Using comparisons and images to make writing more vivid and expressive.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'Simile and Metaphor', body: 'Simile: compares using "like" or "as" ("Her smile was like sunshine"). Metaphor: direct comparison without "like/as" ("Her smile was sunshine"). Metaphors feel more powerful because they state something IS something else.' },
    { id: 'n2', heading: 'Personification and Hyperbole', body: 'Personification: gives human qualities to non-human things ("The wind whispered"). Hyperbole: deliberate exaggeration ("I\'ve told you a million times!").' },
    { id: 'n3', heading: 'Onomatopoeia and Alliteration', body: 'Onomatopoeia: words that sound like the thing (buzz, crash, sizzle). Alliteration: repetition of initial consonant sounds ("Peter Piper picked"). Both create rhythm and emphasis.' },
  ],
  flashcards: [
    { id: 'f1', term: 'Simile', definition: 'Comparison using "like" or "as".', example: '"The boy ran as fast as a cheetah."' },
    { id: 'f2', term: 'Metaphor', definition: 'Direct comparison stating one thing IS another.', example: '"Life is a rollercoaster."' },
    { id: 'f3', term: 'Personification', definition: 'Giving human qualities to non-human things.', example: '"The trees danced in the storm."' },
    { id: 'f4', term: 'Hyperbole', definition: 'Deliberate exaggeration for emphasis or humour.', example: '"I\'m so hungry I could eat a horse."' },
    { id: 'f5', term: 'Onomatopoeia', definition: 'A word that imitates the sound it describes.', example: '"The bees buzzed and the fire crackled."' },
  ],
  questions: [
    { id: 'q1', stem: '"Her laughter was like music" contains a:', choices: ['Metaphor', 'Simile', 'Personification', 'Hyperbole'], correctIndex: 1, explanation: '"Like" signals a simile.' },
    { id: 'q2', stem: '"The old car coughed and spluttered" uses:', choices: ['Simile', 'Hyperbole', 'Alliteration', 'Personification'], correctIndex: 3, explanation: 'Giving human actions (coughing, spluttering) to a car is personification.' },
    { id: 'q3', stem: '"My backpack weighs a tonne" is:', choices: ['Simile', 'Metaphor', 'Hyperbole', 'Personification'], correctIndex: 2, explanation: 'Deliberate exaggeration — not meant literally.' },
    { id: 'q4', stem: 'Repeating initial consonant sounds is:', choices: ['Onomatopoeia', 'Metaphor', 'Personification', 'Alliteration'], correctIndex: 3, explanation: 'Alliteration repeats initial consonant sounds in nearby words.' },
    { id: 'q5', stem: '"Sizzle" is an example of:', choices: ['Metaphor', 'Alliteration', 'Onomatopoeia', 'Hyperbole'], correctIndex: 2, explanation: 'Onomatopoeia — the word sounds like what it describes.' },
  ],
};

const engEssay: Topic = {
  id: 'eng-essay-1', subjectId: 'english', title: 'Essay Writing',
  description: 'Structuring arguments clearly with introduction, body, and conclusion.', ibLevel: 'MYP',
  notes: [
    { id: 'n1', heading: 'Essay Structure', body: 'Introduction → Body paragraphs → Conclusion. Introduction grabs attention, gives background, ends with thesis statement. Each body paragraph develops one point with evidence and analysis. Conclusion summarises and leaves a final thought.' },
    { id: 'n2', heading: 'The Thesis Statement', body: 'A single sentence at the end of your introduction stating your main argument. Must be specific and debatable. Example: "In Macbeth, Shakespeare shows that unchecked ambition leads to self-destruction."' },
    { id: 'n3', heading: 'PEEL Paragraph Method', body: 'P=Point (main idea), E=Evidence (quote/fact), E=Explanation (how evidence proves your point), L=Link (connect back to thesis or to next paragraph).' },
  ],
  flashcards: [
    { id: 'f1', term: 'Thesis statement', definition: 'A clear, specific sentence stating the essay\'s main argument.', example: undefined },
    { id: 'f2', term: 'PEEL', definition: 'Paragraph structure: Point, Evidence, Explanation, Link.', example: undefined },
    { id: 'f3', term: 'Topic sentence', definition: 'Opening sentence of a body paragraph stating its main idea.', example: undefined },
    { id: 'f4', term: 'Conclusion', definition: 'Final paragraph summarising the argument and providing a closing thought.', example: undefined },
    { id: 'f5', term: 'Transition words', definition: 'Words linking ideas: Furthermore, however, in contrast, as a result.', example: undefined },
  ],
  questions: [
    { id: 'q1', stem: 'Where does the thesis statement typically appear?', choices: ['First body paragraph', 'Start of introduction', 'End of conclusion', 'End of introduction'], correctIndex: 3, explanation: 'Usually at the end of the introduction.' },
    { id: 'q2', stem: 'In PEEL, what does the second E stand for?', choices: ['Ending', 'Example', 'Explanation', 'Evidence'], correctIndex: 2, explanation: 'PEEL = Point, Evidence, Explanation, Link.' },
    { id: 'q3', stem: 'Which is the strongest thesis?', choices: ['This essay is about animals.', 'Animals are interesting.', '"Zoos should be banned because they prioritise entertainment over animal welfare."', 'Some people think zoos are bad.'], correctIndex: 2, explanation: 'Specific and debatable — makes a clear claim with a reason.' },
    { id: 'q4', stem: 'A topic sentence\'s purpose is to:', choices: ['Provide a quote', 'Summarise the whole essay', 'State the paragraph\'s main idea', 'Introduce the writer'], correctIndex: 2, explanation: 'Topic sentences focus the paragraph on one idea.' },
    { id: 'q5', stem: 'Which signals contrast?', choices: ['Furthermore', 'In addition', 'However', 'As a result'], correctIndex: 2, explanation: '"However" signals a contrast or shift in argument.' },
  ],
};

export const englishSubject: Subject = {
  id: 'english', name: 'English', icon: 'book', accentColor: '#7B5EA7',
  topics: [engNarrative, engFigurative, engEssay],
};
