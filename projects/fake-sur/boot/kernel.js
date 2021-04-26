window.onerror = function (e, u, l) {
	alert("An unexpected error occurred: " + e + ".\nURL: " + u + "\nLine: " + l + ".");
}
var BOOTVOLUME = "Macintosh HD";
var ROOTFS = null;
var kernel = {
	console: [],
	log: function (msg) {
		kernel.console.push([0, String(msg)]);
		console.log(msg);
	},
	warn: function (msg) {
		kernel.console.push([1, String(msg)]);
		console.warn(msg);
	},
	error: function (msg) {
		kernel.console.push([2, String(msg)]);
		console.error("*** " + msg + " ***");
	},

	readFile: function (file, callback) {
		var rawFile = new XMLHttpRequest();
		rawFile.overrideMimeType("application/json");
		rawFile.open("GET", file, true);
		rawFile.onreadystatechange = function () {
			if (rawFile.readyState === 4 && rawFile.status == "200") {
				callback(rawFile.responseText, file);
			}
		}
		rawFile.send(null);
	},
	exec: function (path) {
		kernel.readFile(path + "/Contents/Info.json", function (fd) {
			var info = JSON.parse(fd);
			kernel.readFile(path + "/Contents/MacOS/" + info.CFBundleExecutable + ".js", function (executeable) {
				eval(executeable);
			});
		});
	},

	loadFramework: function (rpath) {
		var script = document.createElement("script");
		script.innerHTML = rpath;
		document.body.appendChild(script);
	},

	mountFilesystem: function (callback) {
		var fsCheckDidFail = false;
		kernel.log("Mounting filesystem...");
		if (localStorage.getItem("administrator") != null) {
			kernel.log("Administrator account detected.");
			kernel.log("Checking file archive tree...");
			try {
				JSON.parse(localStorage.getItem("administrator"));
				kernel.log("Administrator account data is valid.");
			} catch (e) {
				kernel.log("Administrator account data is unrecognized or corrupted.");
				if (confirm("The Administrator account on this system is invalid. You will not be able log in until this problem is resolved. Should this account be erased?")) {
					kernel.log("Proceeding to erase administrator account...");
					localStorage.removeItem("administrator");
					kernel.log("Continuing with boot process...");
				}
			}
		}
		if (ROOTFS == null) {
			kernel.log("No external system image found. Assuming default OS...");
			fsCheckDidFail = true;
		} else {
			kernel.log("External system image found. Attempting to boot...");
			kernel.log("Checking file archive tree...");
			try {
				JSON.parse(ROOTFS);
				kernel.log("External system image is valid.");
			} catch (e) {
				kernel.log("External system image is not bootable.");
				fsCheckDidFail = true;
			}
		}
		if (fsCheckDidFail == true) {
			kernel.log("Initializing default OS...");
			this.readFile("filesystem.json", function (fileData, fpath) {
				try {
					ROOTFS = fileData;
				} catch (e) {
					kernel.log("Error: Disk space not sufficient for fakeOS.");
				}
				if (fileData == ROOTFS) {
					kernel.log("Filesystem mounted successfully.");
					kernel.log("Checking file archive tree...");
					try {
						JSON.parse(ROOTFS);
						kernel.log("Filesystem is valid.");
						callback();
					} catch (e) {
						kernel.log("Filesystem is not bootable.");
						kernel.log("Filesystem mount failed.");
						kernel.log("Shutting Down...");
						kernel.shutDown();
					}
				} else {
					kernel.log("Filesystem mount failed.");
					kernel.log("Shutting Down...");
					kernel.shutDown();
				}
			});
		} else {
			callback();
		}
	},

	POSIXPath: function (vpath) {
		try {
			var fs = JSON.parse(localStorage.getItem("administrator"));
			var vp = vpath.toString().split("/");
			var vpl = vp.length;
			var cpath = fs;
			for (var i = 0; i < vpl; i++) {
				if (vp[0] == "" && i == 0) {
					cpath = fs[BOOTVOLUME];
				} else {
					cpath = cpath[vp[i]];
				}
			}
			return cpath;
		} catch (e) {
			try {
				var fs = JSON.parse(ROOTFS);
				var vp = vpath.toString().split("/");
				var vpl = vp.length;
				var cpath = fs;
				for (var i = 0; i < vpl; i++) {
					if (vp[0] == "" && i == 0) {
						cpath = fs[BOOTVOLUME];
					} else {
						cpath = cpath[vp[i]];
					}
				}
				return cpath;
			} catch (e) {
				throw (vpath + ": No such file or directory.");
			}
		}
	},

	startupChime: undefined,

	boot: function () {
		document.body.removeAttribute("onclick");
		kernel.log("Initiating boot sequence...");
		kernel.log("Checking firmware...");
		kernel.startupChime = new Audio("boot/startupChime.mp3");
		kernel.startupChime.play();
		kernel.log("Firmware check passed.");
		kernel.log("Detecting displays...");
		document.body.innerHTML = '<div id="bootScreen"><img src="boot/bootLogo.svg" /><progress value="0"></progress></div>';
		kernel.log("Detected internal display: " + window.innerWidth + " x " + window.innerHeight + "px.");
		setTimeout(function () {
			kernel.log("Checking GPU...");
			document.getElementById("bootScreen").style.opacity = 1;
			kernel.log("GPU check passed.");
			setTimeout(function () {
				kernel.log("Proceeding with boot process...");
				document.querySelector("#bootScreen progress").style.visibility = "visible";
				kernel.log("Boot volume is “" + BOOTVOLUME + "”.");
				kernel.mountFilesystem(function () {
					kernel.log("Loading system frameworks...");
					document.querySelector("#bootScreen progress").value += 0.3;
					var fwData = kernel.POSIXPath("/var/db/bootfiles.json")["@CONTENTS"];
					document.querySelector("#bootScreen progress").value += 0.3;
					var fwList = JSON.parse(fwData);
					document.querySelector("#bootScreen progress").value += 0.3;
					var fwListLength = fwList.load.length;
					document.querySelector("#bootScreen progress").value += 0.3;
					for (var i = 0; i < fwListLength; i++) {
						if (kernel.POSIXPath(fwList.load[i])["@TYPE"] == 1) {
							var fwrPath = kernel.POSIXPath(fwList.load[i]);
							kernel.loadFramework(fwrPath["@CONTENTS"]);
							kernel.log("Successfully loaded framework “" + fwList.load[i].split("/")[fwList.load[i].split("/").length - 1].split(".")[0] + "”.");
						} else {
							var infoDotJSON = kernel.POSIXPath(fwList.load[i] + "/Contents/Info.json")["@CONTENTS"];
							var appInfo = JSON.parse(infoDotJSON);
							kernel.loadFramework(kernel.POSIXPath(fwList.load[i] + "/Contents/MacOS/" + appInfo.CFBundleExecutable + ".js")["@CONTENTS"]);
							kernel.log("Launching “" + fwList.load[i].split("/")[fwList.load[i].split("/").length - 1] + "”...");
						}
						document.querySelector("#bootScreen progress").value += 0.3;
					}
				});
			}, 2000);
		}, 4000);
	},
	shutDown: function () {
		kernel.startupChime.pause();
		kernel.startupChime.currentTime = 0;
		document.body.innerHTML = "";
		document.body.setAttribute("onclick", "kernel.boot();");
	},
	reboot: function () {
		kernel.shutDown();
		kernel.boot();
	}

}