package {{pkg}};

import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;

@Mod({{MainClass}}.MODID)
public class {{MainClass}} {
    // [mc:fields]
    public static final String MODID = "{{modId}}";

    public {{MainClass}}(IEventBus modEventBus) {
        // TODO: DeferredRegister 注册（mod bus）+ 游戏事件监听（game bus）。
        // [mc:init]
    }
}
