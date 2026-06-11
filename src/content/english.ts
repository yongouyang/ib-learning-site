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

const engReadingComprehension: Topic = {
  id: 'eng-reading-1', subjectId: 'english', title: 'Reading Comprehension',
  description: 'Strategies for understanding, analysing, and responding to texts.', ibLevel: 'MYP',
  notes: [
    { id: 'read-n1', heading: 'Inference and Explicit Information', body: 'Explicit information is stated directly in the text — you don\'t need to guess. Implicit information (or inference) requires you to "read between the lines" by using clues in the text to work out something the author hasn\'t said outright. For example, if a character "slammed the door and didn\'t speak at dinner," the text never says they are angry, but you can infer it.' },
    { id: 'read-n2', heading: "Author's Purpose and Tone", body: "An author's purpose is why they wrote: to inform (give facts), persuade (change your opinion), entertain (engage and amuse), or describe (create a picture). Tone is the author's attitude — formal, humorous, angry, sympathetic, or sarcastic. Identifying purpose and tone helps you understand what the author really wants you to think or feel." },
    { id: 'read-n3', heading: 'Summarising and Main Idea', body: 'The main idea is the most important point — what the author says ABOUT the topic. A topic is just the subject; the main idea includes the claim. A good summary restates the main idea and key supporting details in your own words, is shorter than the original, accurate, and leaves out unimportant details.' },
  ],
  flashcards: [
    { id: 'read-f1', term: 'Inference', definition: 'A conclusion drawn from evidence in the text rather than something the author states directly.', example: 'If a character wraps their coat tighter, you can infer it is cold outside.' },
    { id: 'read-f2', term: 'Explicit information', definition: 'Information that is stated clearly and directly in the text.', example: '"The train arrived at 9 a.m." — stated outright.' },
    { id: 'read-f3', term: "Author's purpose", definition: 'The reason an author writes: to inform, persuade, entertain, or describe.', example: undefined },
    { id: 'read-f4', term: 'Tone', definition: "The author's attitude or feeling towards the subject or audience, expressed through word choice.", example: 'Formal tone uses precise language; humorous tone uses jokes or sarcasm.' },
    { id: 'read-f5', term: 'Main idea', definition: 'The most important point an author makes about a topic in a text or paragraph.', example: undefined },
  ],
  questions: [
    { id: 'read-q1', stem: 'A text says: "Maria glanced at her watch three times, tapped her foot, and kept looking at the door." What can you INFER?', choices: ['Maria is tired.', 'Maria is waiting anxiously for someone.', 'Maria is angry at someone in the room.', 'Maria wants to leave immediately.'], correctIndex: 1, explanation: 'Watch-checking, foot-tapping, and door-looking are all signs of nervous waiting — not directly stated, but inferred.' },
    { id: 'read-q2', stem: 'Which is an example of EXPLICIT information?', choices: ['The character must be cold because she is shivering.', 'The story probably takes place in winter.', 'The temperature was -5°C according to the weather report.', 'The author seems to dislike the cold season.'], correctIndex: 2, explanation: 'Explicit information is directly stated in the text — like the specific temperature.' },
    { id: 'read-q3', stem: "A newspaper article presents facts and statistics about climate change without opinion. What is the author's likely purpose?", choices: ['To entertain', 'To persuade', 'To inform', 'To describe'], correctIndex: 2, explanation: 'Presenting facts neutrally = purpose is to inform.' },
    { id: 'read-q4', stem: "What is the difference between a 'topic' and a 'main idea'?", choices: ['They are the same thing.', 'The topic is the subject; the main idea is what the author says about that subject.', 'The main idea is the subject; the topic is the author\'s opinion.', 'The topic is found in the conclusion; the main idea in the introduction.'], correctIndex: 1, explanation: 'Topic = subject (e.g. "dogs"). Main idea = claim about that subject (e.g. "Dogs are better pets than cats").' },
    { id: 'read-q5', stem: 'Which word best describes the tone of: "The council has, once again in its infinite wisdom, decided to close the only park"?', choices: ['Formal', 'Sarcastic', 'Sympathetic', 'Neutral'], correctIndex: 1, explanation: '"Infinite wisdom" is used ironically to criticise — this is sarcasm.' },
  ],
};

const engPoetryAnalysis: Topic = {
  id: 'eng-poetry-1', subjectId: 'english', title: 'Poetry Analysis',
  description: 'Understanding how poets use language, structure, and sound to create meaning.', ibLevel: 'MYP',
  notes: [
    { id: 'poe-n1', heading: 'Imagery and Sensory Language', body: 'Imagery refers to language that creates a mental picture or appeals to the senses — sight, sound, smell, touch, and taste. Poets use imagery to make abstract feelings feel real. For example, "golden daffodils that flutter and dance" creates a visual image. Strong imagery is specific and unexpected. When analysing poetry, ask: what does this image make you see, hear, or feel?' },
    { id: 'poe-n2', heading: 'Rhyme and Rhythm', body: 'Rhyme is when words end with the same sound ("moon/June"). A rhyme scheme is the pattern, labelled with letters (ABAB, AABB). Rhythm is the pattern of stressed and unstressed syllables — the "beat" of the poem. Regular rhythm can feel calm; irregular rhythm can feel chaotic. Together, rhyme and rhythm give poetry its musical quality.' },
    { id: 'poe-n3', heading: 'Structure and Form', body: 'Structure includes how a poem is organised into stanzas (groups of lines), line lengths, and fixed forms. A sonnet has 14 lines; a haiku has 3 lines (5-7-5 syllables). Free verse has no fixed rhyme or meter. Line breaks create pauses and emphasis. Enjambment is when a sentence runs on from one line to the next without a pause.' },
  ],
  flashcards: [
    { id: 'poe-f1', term: 'Imagery', definition: 'Descriptive language that appeals to the senses and creates vivid mental pictures.', example: '"The crimson sun melted into the horizon."' },
    { id: 'poe-f2', term: 'Rhyme scheme', definition: 'The pattern of rhymes at the end of each line, identified by letters (e.g., ABAB).', example: 'Roses are red (A), violets are blue (B), sugar is sweet (A)... — AAB' },
    { id: 'poe-f3', term: 'Stanza', definition: 'A group of lines in a poem, similar to a paragraph in prose.', example: 'A four-line stanza is called a quatrain.' },
    { id: 'poe-f4', term: 'Enjambment', definition: 'When a sentence or phrase continues past the end of one line into the next without a pause.', example: undefined },
    { id: 'poe-f5', term: 'Free verse', definition: 'Poetry that does not follow a regular rhyme scheme or metrical pattern.', example: undefined },
  ],
  questions: [
    { id: 'poe-q1', stem: '"The moon hung like a lantern over the sleeping city." This line is an example of:', choices: ['Alliteration', 'Rhyme', 'Imagery', 'Enjambment'], correctIndex: 2, explanation: 'The line creates a vivid visual picture — this is imagery.' },
    { id: 'poe-q2', stem: 'A poem has line 1 rhyming with line 3, and line 2 with line 4. What rhyme scheme?', choices: ['AABB', 'ABBA', 'ABAB', 'AAAA'], correctIndex: 2, explanation: 'ABAB = alternating rhyme scheme.' },
    { id: 'poe-q3', stem: 'What is enjambment in poetry?', choices: ['A group of lines forming a section', 'A comparison using "like" or "as"', 'When a sentence runs from one line to the next without a full stop', 'A poem with exactly 14 lines'], correctIndex: 2, explanation: 'Enjambment = the sentence continues over the line break without a pause.' },
    { id: 'poe-q4', stem: 'A poem with no set rhyme scheme or regular rhythm is written in:', choices: ['Sonnet form', 'Free verse', 'Haiku form', 'A quatrain'], correctIndex: 1, explanation: 'Free verse has no fixed rhyme scheme or meter.' },
    { id: 'poe-q5', stem: 'Why is it important to comment on a poet\'s specific word choice?', choices: ['To show you have read the poem', 'Because all words in a poem are there by accident', 'Because word choice reveals the poet\'s intentions and creates specific effects', 'To count the syllables'], correctIndex: 2, explanation: 'Poets choose words deliberately for sound, meaning, and connotation. Analysing word choice reveals mood and meaning.' },
  ],
};

export const englishSubject: Subject = {
  id: 'english', name: 'English', icon: 'book', accentColor: '#7B5EA7',
  topics: [engNarrative, engFigurative, engEssay, engReadingComprehension, engPoetryAnalysis],
};
