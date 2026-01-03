// Province Model
// Represents a province (provinsi) in Indonesia

class Province {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.code = data.code;
    this.isActive = data.is_active;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Convert to JSON for API response
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Simplified JSON (untuk dropdown/selection)
  toSimpleJSON() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
    };
  }
}

module.exports = Province;
