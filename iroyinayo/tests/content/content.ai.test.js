const { buildPrompt, parseResponse, CATEGORIES } = require('../../src/modules/content/content.ai');

describe('Content AI', () => {
  describe('buildPrompt', () => {
    it('returns a prompt string containing the category', () => {
      const prompt = buildPrompt('tech');
      expect(prompt).toContain('"tech"');
      expect(prompt).toContain('University of Ilorin');
      expect(prompt).toContain('TITLE:');
      expect(prompt).toContain('BODY:');
    });

    it('includes category-specific description', () => {
      const prompt = buildPrompt('scholarships');
      expect(prompt).toContain('scholarship opportunities');
    });
  });

  describe('parseResponse', () => {
    it('parses valid TITLE/BODY response', () => {
      const text = 'TITLE: New Scholarship Opportunity for Engineering Students\nBODY: The Faculty of Engineering has announced a new scholarship.\n\nStudents with a CGPA of 3.5 and above can apply.';
      const result = parseResponse(text);
      expect(result.title).toBe('New Scholarship Opportunity for Engineering Students');
      expect(result.body).toContain('Faculty of Engineering');
      expect(result.body).toContain('CGPA of 3.5');
    });

    it('throws on malformed response', () => {
      expect(() => parseResponse('Just some random text')).toThrow('Failed to parse AI response');
    });

    it('handles extra whitespace', () => {
      const text = 'TITLE:   Spaced Title  \nBODY:   Body with spaces  ';
      const result = parseResponse(text);
      expect(result.title).toBe('Spaced Title');
      expect(result.body).toBe('Body with spaces');
    });
  });

  describe('CATEGORIES', () => {
    it('has 8 categories', () => {
      expect(CATEGORIES).toHaveLength(8);
    });

    it('includes expected categories', () => {
      expect(CATEGORIES).toContain('scholarships');
      expect(CATEGORIES).toContain('tech');
      expect(CATEGORIES).toContain('campus_news');
    });
  });
});
