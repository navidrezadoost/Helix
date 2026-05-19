export class DraftStorage {
    static save(key: string, data: Record<string, any>, meta: Record<string, any> = {}): void {
        try {
            const payload = {
                data,
                meta,
                timestamp: Date.now()
            };
            localStorage.setItem(`helix_draft_${key}`, JSON.stringify(payload));
        } catch (err) {
            console.warn('Helix: Failed to save draft to localStorage', err);
        }
    }

    static load(key: string): { data: Record<string, any>, meta: Record<string, any>, timestamp: number } | null {
        try {
            const payload = localStorage.getItem(`helix_draft_${key}`);
            if (!payload) return null;
            
            const parsed = JSON.parse(payload);
            // Optional: Expiration logic (e.g., drafts expire after 7 days)
            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - parsed.timestamp > SEVEN_DAYS) {
                this.clear(key);
                return null;
            }
            
            return parsed;
        } catch (err) {
            console.warn('Helix: Failed to load draft from localStorage', err);
            return null;
        }
    }

    static clear(key: string): void {
        try {
            localStorage.removeItem(`helix_draft_${key}`);
        } catch (err) {
            console.warn('Helix: Failed to clear draft from localStorage', err);
        }
    }
}
