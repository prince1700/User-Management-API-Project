const express = require("express");
const multer = require("multer");
const User = require("../models/User");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },

  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

// File filter
const fileFilter = function (req, file, cb) {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only jpg, jpeg and png files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter
});

// 5. Get All Users with Pagination
// GET /api/users?page=1&limit=5
router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;

    const skip = (page - 1) * limit;

    const users = await User.find()
      .select("-password")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments();

    res.json({
      message: "Users fetched successfully",
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      users
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

// 6. Search Users
// GET /api/users/search?name=imran
router.get("/search", protect, adminOnly, async (req, res) => {
  try {
    const name = req.query.name || "";

    const users = await User.find({
      name: { $regex: name, $options: "i" }
    }).select("-password");

    res.json({
      message: "Search results fetched successfully",
      users
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

// 7. Admin Dashboard Stats
// GET /api/users/admin/stats
router.get("/admin/stats", protect, adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const activeUsers = await User.countDocuments({ isBlocked: false });
    const blockedUsers = await User.countDocuments({ isBlocked: true });

    res.json({
      message: "Dashboard stats fetched successfully",
      stats: {
        totalUsers,
        totalAdmins,
        activeUsers,
        blockedUsers
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

// 8. Upload Profile Image
// POST /api/users/upload-profile
router.post(
  "/upload-profile",
  protect,
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      user.profileImage = `/uploads/${req.file.filename}`;
      await user.save();

      res.json({
        message: "Profile image uploaded successfully",
        profileImage: user.profileImage
      });
    } catch (error) {
      res.status(500).json({
        message: "Image upload failed"
      });
    }
  }
);

// 9. Update User Role
// PUT /api/users/:id/role
router.put("/:id/role", protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({
        message: "Role must be either user or admin"
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json({
      message: "User role updated successfully",
      user
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

// 10. Block User
// PUT /api/users/:id/block
router.put("/:id/block", protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json({
      message: "User blocked successfully",
      user
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

// 11. Unblock User
// PUT /api/users/:id/unblock
router.put("/:id/unblock", protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json({
      message: "User unblocked successfully",
      user
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

// 12. Get Single User by ID
// GET /api/users/:id
router.get("/:id", protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json({
      message: "User fetched successfully",
      user
    });
  } catch (error) {
    res.status(500).json({
      message: "Invalid user ID"
    });
  }
});

// 13. Update User
// PUT /api/users/:id
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const { name, email } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, email },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json({
      message: "User updated successfully",
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

// 14. Delete User
// DELETE /api/users/:id
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json({
      message: "User deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;