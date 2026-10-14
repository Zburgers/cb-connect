#!/usr/bin/env python3
import os
import stat
import sys


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


def open_directory(name, parent_fd, label):
    created = False
    try:
        fd = os.open(name, directory_flags, dir_fd=parent_fd)
    except FileNotFoundError:
        try:
            os.mkdir(name, 0o750, dir_fd=parent_fd)
            created = True
        except FileExistsError:
            pass
        except OSError:
            fail(f"{label} cannot be created safely")
        try:
            fd = os.open(name, directory_flags, dir_fd=parent_fd)
        except OSError:
            fail(f"{label} is not a safe directory")
    except OSError:
        fail(f"{label} is not a safe directory")

    metadata = os.fstat(fd)
    if not stat.S_ISDIR(metadata.st_mode) or metadata.st_uid != owner:
        os.close(fd)
        fail(f"{label} has an unsafe type or owner")
    mode = 0o750 if created else stat.S_IMODE(metadata.st_mode) & ~0o022
    os.fchmod(fd, mode)
    return fd


home = os.environ.get("HOME", "")
pm2_home = os.environ.get("PM2_HOME", os.path.join(home, ".pm2"))
if not home or not os.path.isabs(home) or pm2_home != os.path.join(home, ".pm2"):
    fail("PM2 home does not match the approved user log root")

if not hasattr(os, "O_NOFOLLOW") or not hasattr(os, "O_DIRECTORY"):
    fail("descriptor-safe PM2 log permissions are unavailable")

owner = os.getuid()
directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
file_flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | getattr(os, "O_CLOEXEC", 0)

try:
    home_fd = os.open(home, directory_flags)
except OSError:
    fail("user home is not a safe directory")

try:
    home_metadata = os.fstat(home_fd)
    if not stat.S_ISDIR(home_metadata.st_mode) or home_metadata.st_uid != owner:
        fail("user home has an unsafe type or owner")
    pm2_fd = open_directory(".pm2", home_fd, "PM2 home")
finally:
    os.close(home_fd)

try:
    logs_fd = open_directory("logs", pm2_fd, "PM2 log directory")
finally:
    os.close(pm2_fd)

try:
    for name in ("cb-connect-out.log", "cb-connect-error.log"):
        try:
            fd = os.open(name, file_flags, dir_fd=logs_fd)
        except FileNotFoundError:
            continue
        except OSError:
            fail("CB Connect log file is not a safe regular file")
        try:
            metadata = os.fstat(fd)
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != owner:
                fail("CB Connect log file has an unsafe type or owner")
            if metadata.st_nlink != 1:
                fail("CB Connect log file has multiple hard links")
            os.fchmod(fd, stat.S_IMODE(metadata.st_mode) & ~0o022)
        finally:
            os.close(fd)
finally:
    os.close(logs_fd)
