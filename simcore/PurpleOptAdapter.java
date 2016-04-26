import java.lang.IllegalArgumentException;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.lang.StringBuffer;

import org.json.simple.parser.JSONParser;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.codehaus.jackson.map.*;

public class PurpleOptAdapter {
  public static void main(String[] args) {

    if (args.length == 0) { // input from standard input
      BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
      JSONObject parsedJSON = null;

      try {
        StringBuffer sb = new StringBuffer();
        String thisLine = null;
        while ((thisLine = br.readLine()) != null) {
          sb.append(thisLine);
          sb.append('\n');
        }
        parsedJSON = (JSONObject) (new JSONParser()).parse(sb.toString());
      } catch (Exception e) {
        e.printStackTrace();
      }

      HashMap<String, Object> returnedResult = PurpleOpt.computeSuggestion(parsedJSON);
      System.out.print(JSONObject.toJSONString(returnedResult));

    } else if (args.length == 1) { // input from file
      String inputFileName = args[0];
      JSONObject parsedJSON = null;
      FileWriter fw = null;
      try {
        parsedJSON = (JSONObject) (new JSONParser().parse(
          new FileReader(
            new File(
              inputFileName))));
        HashMap<String, Object> returnedResult = PurpleOpt.computeSuggestion(new ObjectMapper().readValue(new File(args[0]), HashMap.class));
        fw = new FileWriter("gout.json");
        fw.write(JSONObject.toJSONString(returnedResult));
        fw.close();
      } catch (Exception e) {
        e.printStackTrace();
      }
    } else {
      throw new IllegalArgumentException("Please give me a file name.");
    }
  }
}