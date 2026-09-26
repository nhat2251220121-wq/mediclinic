/**
 * Middleware kiểm tra quyền người dùng (Role-Based Access Control)
 * @param  {...string} allowedRoles Danh sách các role được phép truy cập (VD: 'ADMIN', 'DOCTOR')
 */
const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Chưa xác thực người dùng. Vui lòng đăng nhập.'
            });
        }

        const userRole = req.user.role;
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Quyền truy cập bị từ chối. Chức năng này yêu cầu quyền [${allowedRoles.join(', ')}], nhưng tài khoản của bạn là [${userRole}].`
            });
        }

        next();
    };
};

// Shorthand middleware cho từng Role
const isAdmin = checkRole('ADMIN');
const isDoctor = checkRole('DOCTOR');
const isPatient = checkRole('PATIENT');
const isStaffOrAdmin = checkRole('ADMIN', 'DOCTOR');

module.exports = {
    checkRole,
    isAdmin,
    isDoctor,
    isPatient,
    isStaffOrAdmin
};
