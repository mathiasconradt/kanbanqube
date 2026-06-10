class Kanbanqube < Formula
  desc "Local-first Kanban board backed by normal files"
  homepage "https://github.com/mathiasconradt/kanbanqube"
  version "1.0.6"
  url "https://github.com/mathiasconradt/kanbanqube/releases/download/v#{version}/kanbanqube-#{version}.tgz"
  sha256 "f15f39c16252cfda06d3e6809985d7030873b061a1ec745fe93959ee4b54b76f"
  license "Apache-2.0"

  depends_on "node"

  def install
    app_root = buildpath/"package"
    libexec.install app_root.children
    bin.write_exec_script libexec/"server.js"
  end

  test do
    system bin/"kanbanqube", "--help"
  end
end
