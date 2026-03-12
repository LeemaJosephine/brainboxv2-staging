const Category = require("../models/Category");

exports.createCategory = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "team_manager") {
      return res.status(403).json({ message: "Only admin or team manager can add categories" });
    }
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }
    const existing = await Category.findOne({ name: String(name).trim() });
    if (existing) {
      return res.status(400).json({ message: "Category with this name already exists" });
    }
    const category = await Category.create({ name: String(name).trim() });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create category" });
  }
};

exports.getCategories = async (req, res) => {
  try {
    let categories = await Category.find().sort({ name: 1 }).select("-__v").lean();
    if (!categories || categories.length === 0) {
      const general = await Category.create({ name: "General" });
      categories = [general.toObject()];
    }
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch categories" });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch category" });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "team_manager") {
      return res.status(403).json({ message: "Only admin or team manager can edit categories" });
    }
    const { name } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    if (name != null && String(name).trim()) {
      const existing = await Category.findOne({ name: String(name).trim(), _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ message: "Category with this name already exists" });
      }
      category.name = String(name).trim();
    }
    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update category" });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "team_manager") {
      return res.status(403).json({ message: "Only admin or team manager can delete categories" });
    }
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.json({ message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to delete category" });
  }
};
